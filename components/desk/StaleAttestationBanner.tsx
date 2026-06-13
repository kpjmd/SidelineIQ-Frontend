interface Props {
  show: boolean;
}

// Advisory only — the publish gate's hash_match check is the real enforcement.
// Shown when the post has been edited since its latest attestation.
export function StaleAttestationBanner({ show }: Props) {
  if (!show) return null;
  return (
    <div className="bg-amber-950/60 border border-amber-800 rounded-lg px-4 py-3 text-sm text-amber-200">
      <span className="font-semibold">Re-attestation required.</span> You&apos;ve edited this post since it
      was last attested. Re-attest before publishing — the publish gate will reject a stale attestation.
    </div>
  );
}
