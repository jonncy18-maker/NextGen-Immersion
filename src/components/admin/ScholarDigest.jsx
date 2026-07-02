import AiInsightCard from './AiInsightCard.jsx'

export default function ScholarDigest({ userId }) {
  return <AiInsightCard label="AI Scholar Digest" endpoint="/api/scholar-digest" userId={userId} />
}
