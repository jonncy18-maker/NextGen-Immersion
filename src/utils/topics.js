// 10 fixed topic tags grouped into 3 color categories (see ARCHITECTURE.md).
export const TOPIC_CATEGORIES = [
  {
    key: 'oet',
    label: 'OET / Career',
    color: 'var(--ngsi-cat-oet)',
    topics: ['Medical & Nursing', 'Work & Career', 'Academic & Study'],
  },
  {
    key: 'life',
    label: 'Daily Life',
    color: 'var(--ngsi-cat-life)',
    topics: ['Daily Life', 'Travel & Places', 'Social & Relationships'],
  },
  {
    key: 'compelling',
    label: 'Compelling Interest',
    color: 'var(--ngsi-cat-compelling)',
    topics: ['Food & Cooking', 'Culture & Entertainment', 'Sports & Fitness', 'News & Events'],
  },
]

// Flat list of all 10 topics.
export const ALL_TOPICS = TOPIC_CATEGORIES.flatMap((c) => c.topics)

// Returns the CSS color var for a topic tag, or the compelling/gray default.
export function getTopicColor(topic) {
  const cat = TOPIC_CATEGORIES.find((c) => c.topics.includes(topic))
  return cat ? cat.color : 'var(--ngsi-cat-compelling)'
}
