import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { storeRead, storeWrite } from "./api";
import { useSettings } from "./settings";
import type {
  ChemicalSummary,
  Collection,
  CollectionItem,
  FavoriteChemical,
  FavoriteLoi,
  FavoriteRegulation,
  LoiSummary,
  NoteMap,
  RegulationSummary,
} from "./types";

/** Free-tier capacity. Premium unlocks unlimited. */
export const FREE_FAVORITES_MAX = 15;      // regulation favorites only
export const FREE_COLLECTIONS_MAX = 10;

/** Loads a JSON document once, then persists every change atomically. */
function usePersistentState<T>(
  name: string,
  initial: T,
): [T, (updater: (prev: T) => T) => void, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    storeRead<T>(name)
      .then((data) => {
        if (data != null) setValue(data);
      })
      .finally(() => {
        loaded.current = true;
        setReady(true);
      });
  }, [name]);

  useEffect(() => {
    if (!loaded.current) return;
    storeWrite(name, value).catch((e) =>
      console.error(`failed to persist ${name}:`, e),
    );
  }, [name, value]);

  const update = useCallback((updater: (prev: T) => T) => {
    setValue((prev) => updater(prev));
  }, []);

  return [value, update, ready];
}

// ---------- snapshot helpers ----------

export function toCollectionItem(item: RegulationSummary): CollectionItem {
  return {
    kind: "regulation",
    id: item.regulationId,
    label: item.heading,
    sublabel: item.citation,
    agency: item.agency,
    addedAt: Date.now(),
  };
}

export function toLoiCollectionItem(item: LoiSummary): CollectionItem {
  return {
    kind: "loi",
    id: item.loiId,
    label: item.title,
    sublabel: item.issueDate,
    agency: null,
    addedAt: Date.now(),
  };
}

export function toChemicalCollectionItem(item: ChemicalSummary): CollectionItem {
  return {
    kind: "chemical",
    id: item.substanceName,
    label: item.substanceName,
    sublabel: item.oshaPelTwa ? `PEL TWA ${item.oshaPelTwa}` : "No PEL TWA",
    agency: null,
    addedAt: Date.now(),
  };
}

function toFavorite(item: RegulationSummary): FavoriteRegulation {
  return {
    regulationId: item.regulationId,
    citation: item.citation,
    heading: item.heading,
    agency: item.agency,
    subpartLabel: item.subpartLabel,
    addedAt: Date.now(),
  };
}

function toFavoriteLoi(item: LoiSummary): FavoriteLoi {
  return {
    loiId: item.loiId,
    title: item.title,
    issueDate: item.issueDate,
    addedAt: Date.now(),
  };
}

function toFavoriteChemical(item: ChemicalSummary): FavoriteChemical {
  return {
    substanceName: item.substanceName,
    oshaPelTwa: item.oshaPelTwa,
    idlh: item.idlh,
    isOshaCarcinogen: item.isOshaCarcinogen,
    addedAt: Date.now(),
  };
}

// ---------- context interface ----------

interface AppData {
  ready: boolean;

  // --- Regulation favorites (capped in free tier) ---
  favorites: FavoriteRegulation[];
  isFavorite: (regulationId: string) => boolean;
  toggleFavorite: (item: RegulationSummary) => void;
  removeFavorite: (regulationId: string) => void;

  // --- LOI favorites (uncapped — separate entity kind) ---
  favoriteLois: FavoriteLoi[];
  isFavoriteLoi: (loiId: string) => boolean;
  toggleFavoriteLoi: (item: LoiSummary) => void;
  removeFavoriteLoi: (loiId: string) => void;

  // --- Chemical favorites (uncapped — separate entity kind) ---
  favoriteChemicals: FavoriteChemical[];
  isFavoriteChemical: (substanceName: string) => boolean;
  toggleFavoriteChemical: (item: ChemicalSummary) => void;
  removeFavoriteChemical: (substanceName: string) => void;

  // --- Collections ---
  collections: Collection[];
  createCollection: (name: string, emoji: string) => string | null;
  renameCollection: (id: string, name: string, emoji: string) => void;
  deleteCollection: (id: string) => void;
  addToCollection: (id: string, item: CollectionItem) => void;
  removeFromCollection: (collectionId: string, itemId: string) => void;
  isInCollection: (collectionId: string, itemId: string) => boolean;

  // --- Notes ---
  notes: NoteMap;
  setNote: (key: string, text: string) => void;
  deleteNote: (key: string) => void;

  // --- Freemium ---
  favoritesMax: number;
  collectionsMax: number;
  premiumPrompt: string | null;
  promptPremium: (message: string) => void;
  clearPremiumPrompt: () => void;
}

const AppDataContext = createContext<AppData | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { unlocked } = useSettings();

  // Regulation favorites — stored as "favorites" for back-compat.
  const [favorites, updateFavorites, favReady] = usePersistentState<
    FavoriteRegulation[]
  >("favorites", []);

  // LOI favorites — separate JSON doc so the regulation cap isn't polluted.
  const [favoriteLois, updateFavoriteLois, favLoisReady] = usePersistentState<
    FavoriteLoi[]
  >("favorites.loi", []);

  // Chemical favorites — separate JSON doc.
  const [favoriteChemicals, updateFavoriteChemicals, favChemReady] =
    usePersistentState<FavoriteChemical[]>("favorites.chemicals", []);

  const [collections, updateCollections, colReady] = usePersistentState<
    Collection[]
  >("collections", []);
  const [notes, updateNotes, notesReady] = usePersistentState<NoteMap>(
    "notes",
    {},
  );
  const [premiumPrompt, setPremiumPrompt] = useState<string | null>(null);

  const favoritesMax = unlocked ? Infinity : FREE_FAVORITES_MAX;
  const collectionsMax = unlocked ? Infinity : FREE_COLLECTIONS_MAX;

  const promptPremium = useCallback((message: string) => {
    setPremiumPrompt(message);
  }, []);
  const clearPremiumPrompt = useCallback(() => setPremiumPrompt(null), []);

  // -------- Regulation favorites --------

  const isFavorite = useCallback(
    (regulationId: string) =>
      favorites.some((f) => f.regulationId === regulationId),
    [favorites],
  );

  const toggleFavorite = useCallback(
    (item: RegulationSummary) => {
      const exists = favorites.some(
        (f) => f.regulationId === item.regulationId,
      );
      if (!exists && favorites.length >= favoritesMax) {
        setPremiumPrompt(
          `The free plan keeps up to ${FREE_FAVORITES_MAX} regulation favorites. ` +
            `Unlock unlimited favorites with premium.`,
        );
        return;
      }
      updateFavorites((prev) => {
        if (prev.some((f) => f.regulationId === item.regulationId)) {
          return prev.filter((f) => f.regulationId !== item.regulationId);
        }
        return [toFavorite(item), ...prev];
      });
    },
    [favorites, favoritesMax, updateFavorites],
  );

  const removeFavorite = useCallback(
    (regulationId: string) => {
      updateFavorites((prev) =>
        prev.filter((f) => f.regulationId !== regulationId),
      );
    },
    [updateFavorites],
  );

  // -------- LOI favorites --------

  const isFavoriteLoi = useCallback(
    (loiId: string) => favoriteLois.some((f) => f.loiId === loiId),
    [favoriteLois],
  );

  const toggleFavoriteLoi = useCallback(
    (item: LoiSummary) => {
      updateFavoriteLois((prev) => {
        if (prev.some((f) => f.loiId === item.loiId)) {
          return prev.filter((f) => f.loiId !== item.loiId);
        }
        return [toFavoriteLoi(item), ...prev];
      });
    },
    [updateFavoriteLois],
  );

  const removeFavoriteLoi = useCallback(
    (loiId: string) => {
      updateFavoriteLois((prev) => prev.filter((f) => f.loiId !== loiId));
    },
    [updateFavoriteLois],
  );

  // -------- Chemical favorites --------

  const isFavoriteChemical = useCallback(
    (substanceName: string) =>
      favoriteChemicals.some((f) => f.substanceName === substanceName),
    [favoriteChemicals],
  );

  const toggleFavoriteChemical = useCallback(
    (item: ChemicalSummary) => {
      updateFavoriteChemicals((prev) => {
        if (prev.some((f) => f.substanceName === item.substanceName)) {
          return prev.filter((f) => f.substanceName !== item.substanceName);
        }
        return [toFavoriteChemical(item), ...prev];
      });
    },
    [updateFavoriteChemicals],
  );

  const removeFavoriteChemical = useCallback(
    (substanceName: string) => {
      updateFavoriteChemicals((prev) =>
        prev.filter((f) => f.substanceName !== substanceName),
      );
    },
    [updateFavoriteChemicals],
  );

  // -------- Collections --------

  const createCollection = useCallback(
    (name: string, emoji: string): string | null => {
      if (collections.length >= collectionsMax) {
        setPremiumPrompt(
          `The free plan keeps up to ${FREE_COLLECTIONS_MAX} collections. ` +
            `Unlock unlimited collections with premium.`,
        );
        return null;
      }
      const id = crypto.randomUUID();
      updateCollections((prev) => [
        ...prev,
        { id, name, emoji, createdAt: Date.now(), items: [] },
      ]);
      return id;
    },
    [collections, collectionsMax, updateCollections],
  );

  const renameCollection = useCallback(
    (id: string, name: string, emoji: string) => {
      updateCollections((prev) =>
        prev.map((c) => (c.id === id ? { ...c, name, emoji } : c)),
      );
    },
    [updateCollections],
  );

  const deleteCollection = useCallback(
    (id: string) => {
      updateCollections((prev) => prev.filter((c) => c.id !== id));
    },
    [updateCollections],
  );

  const addToCollection = useCallback(
    (id: string, item: CollectionItem) => {
      updateCollections((prev) =>
        prev.map((c) => {
          if (c.id !== id || c.items.some((i) => i.id === item.id)) return c;
          return { ...c, items: [...c.items, item] };
        }),
      );
    },
    [updateCollections],
  );

  const removeFromCollection = useCallback(
    (collectionId: string, itemId: string) => {
      updateCollections((prev) =>
        prev.map((c) =>
          c.id === collectionId
            ? { ...c, items: c.items.filter((i) => i.id !== itemId) }
            : c,
        ),
      );
    },
    [updateCollections],
  );

  const isInCollection = useCallback(
    (collectionId: string, itemId: string) =>
      collections
        .find((c) => c.id === collectionId)
        ?.items.some((i) => i.id === itemId) ?? false,
    [collections],
  );

  // -------- Notes --------

  const setNote = useCallback(
    (key: string, text: string) => {
      updateNotes((prev) => ({
        ...prev,
        [key]: { text, editedAt: Date.now() },
      }));
    },
    [updateNotes],
  );

  const deleteNote = useCallback(
    (key: string) => {
      updateNotes((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [updateNotes],
  );

  return (
    <AppDataContext.Provider
      value={{
        ready: favReady && favLoisReady && favChemReady && colReady && notesReady,
        favorites,
        isFavorite,
        toggleFavorite,
        removeFavorite,
        favoriteLois,
        isFavoriteLoi,
        toggleFavoriteLoi,
        removeFavoriteLoi,
        favoriteChemicals,
        isFavoriteChemical,
        toggleFavoriteChemical,
        removeFavoriteChemical,
        collections,
        createCollection,
        renameCollection,
        deleteCollection,
        addToCollection,
        removeFromCollection,
        isInCollection,
        notes,
        setNote,
        deleteNote,
        favoritesMax,
        collectionsMax,
        premiumPrompt,
        promptPremium,
        clearPremiumPrompt,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData(): AppData {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}
