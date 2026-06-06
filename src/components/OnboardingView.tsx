import iconUrl from "../assets/app-icon.png";

interface Props {
  onDismiss: () => void;
}

export function OnboardingView({ onDismiss }: Props) {
  return (
    <div className="onboarding-backdrop">
      <div className="onboarding">
        <img className="onboarding__icon" src={iconUrl} alt="EHS Snap" />
        <h1 className="onboarding__title">EHS Snap</h1>
        <p className="onboarding__tagline">
          29 CFR · 30 CFR · LOI · chemicals — offline
        </p>

        <div className="onboarding__features">
          <FeatureRow
            icon="⌕"
            text="Search OSHA 29 CFR 1910 + MSHA 30 CFR + 4,000 letters of interpretation"
          />
          <FeatureRow
            icon="★"
            text="Favorite citations and group them into program-area collections"
          />
          <FeatureRow
            icon="🧪"
            text="700+ chemicals — OSHA PEL, NIOSH REL, IDLH at your fingertips"
          />
          <FeatureRow
            icon="✓"
            text="No ads, no subscription. Works offline on the plant floor."
          />
        </div>

        <p className="onboarding__footer">
          Built for EHS managers, safety specialists, industrial hygienists,
          and compliance officers.
        </p>

        <button className="onboarding__cta" onClick={onDismiss}>
          Get Started
        </button>
      </div>
    </div>
  );
}

function FeatureRow({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="onboarding__feature">
      <span className="onboarding__feature-icon">{icon}</span>
      <span className="onboarding__feature-text">{text}</span>
    </div>
  );
}
