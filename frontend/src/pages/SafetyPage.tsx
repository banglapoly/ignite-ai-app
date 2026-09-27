import { SafetyBlock } from '../components/Sections'
import EnvTabs from '../components/EnvTabs'
import { NextLinks, PageHead } from '../components/Layout'
import { useSim } from '../lib/sim'

export default function SafetyPage() {
  const { env } = useSim()
  return (
    <>
      <PageHead kicker="Safety measures" title="Fire safety measures & insights">
        Detection, ventilation shutdown, suppression, material selection and crew procedures from NASA sources, for each environment. Pick an environment below.
      </PageHead>
      <EnvTabs />
      {env && <SafetyBlock env={env} />}
      <NextLinks path="/safety" />
    </>
  )
}
