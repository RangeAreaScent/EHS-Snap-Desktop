import iconUrl from "../assets/app-icon.png";

interface Props {
  onDismiss: () => void;
}

export function OnboardingView({ onDismiss }: Props) {
  return (
    <div className="onboarding-backdrop">
      <div className="onboarding">
        <img className="onboarding__icon" src={iconUrl} alt="ICD Snap" />
        <h1 className="onboarding__title">ICD Snap</h1>
        <p className="onboarding__tagline">
          ICD-10-CM — fast, free, offline
        </p>

        <div className="onboarding__features">
          <FeatureRow
            icon="⌕"
            text="Find 74,000+ billable codes in seconds"
          />
          <FeatureRow
            icon="★"
            text="Save favorites and organize into collections"
          />
          <FeatureRow
            icon="✎"
            text="Add notes; export to CSV or PDF"
          />
          <FeatureRow
            icon="✓"
            text="No ads, no subscription. Works offline."
          />
        </div>

        <p className="onboarding__footer">
          Built for clinicians, billers, and coders.
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
