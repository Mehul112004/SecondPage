import { Screen, Feedback } from '../../components/ui'
import { Portfolio } from '../../components/Portfolio'
export default function HistoryScreen() { return <Screen title="Trade history" subtitle="Every practice trade, with its execution price."><Feedback /><Portfolio history /></Screen> }
