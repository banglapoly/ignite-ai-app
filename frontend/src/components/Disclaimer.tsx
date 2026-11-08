export default function Disclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <p className={compact ? 'disclaimer compact' : 'disclaimer'} role="note">
      Research and education aid. IGNITE-AI does not certify a material, clear a vehicle, or simulate flame physics.
      A model class is a statistical estimate from the loaded tests. The 3D flame is an illustration.
      No estimate is not a finding that a condition is safe. This build does not claim a particular challenge brief has been verified.
    </p>
  )
}
