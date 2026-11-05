import { Screen, Feedback } from '../../components/ui'
import { Metrics } from '../../components/Metrics'
import { Portfolio } from '../../components/Portfolio'
export default function PortfolioScreen() { return <Screen title="Portfolio" subtitle="Your positions. A clearer perspective."><Metrics /><Feedback /><Portfolio /></Screen> }
