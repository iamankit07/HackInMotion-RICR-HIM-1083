/**
 * How confident we are that a student knows a topic, on a 0–1 scale.
 *
 * Two sources disagree constantly: what the student says they know, and what
 * they actually got right. Neither is trustworthy alone — self-ratings are
 * optimistic, and three quiz questions is a small sample. So the self-rating is
 * treated as a prior worth PRIOR_WEIGHT imaginary questions, and every real
 * answer pulls the estimate toward measured performance.
 *
 *   mastery = (correct + prior × PRIOR_WEIGHT) / (answered + PRIOR_WEIGHT)
 *
 * With no answers it returns the self-rating exactly. After a dozen questions
 * the self-rating barely matters. This is Laplace smoothing over a beta-binomial
 * estimate, and it is the reason a confident student who fails the diagnostic
 * still gets those topics scheduled first.
 */

export const CONFIDENCE_PRIORS = {
  beginner: 0.2,
  intermediate: 0.45,
  advanced: 0.7,
};

const PRIOR_WEIGHT = 2;

export const MASTERED_THRESHOLD = 0.85;
export const REVIEW_THRESHOLD = 0.5;

export function priorFor(confidence) {
  return CONFIDENCE_PRIORS[confidence] ?? CONFIDENCE_PRIORS.beginner;
}

export function estimateMastery({ prior, questionsCorrect = 0, questionsAnswered = 0 }) {
  const smoothed =
    (questionsCorrect + prior * PRIOR_WEIGHT) / (questionsAnswered + PRIOR_WEIGHT);

  return clamp(smoothed, 0, 1);
}

export function statusFor(mastery, questionsAnswered) {
  if (questionsAnswered === 0 && mastery === 0) {
    return 'not_started';
  }

  if (mastery >= MASTERED_THRESHOLD) {
    return 'mastered';
  }

  return mastery >= REVIEW_THRESHOLD ? 'review' : 'learning';
}

/**
 * Topics worth worrying about, worst first. Importance is folded in so that a
 * shaky topic worth five marks does not outrank a shaky topic worth twenty.
 */
export function rankWeakTopics(topics, progressByTopic, limit = 5) {
  return topics
    .map((topic) => {
      const mastery = progressByTopic.get(topic.key)?.mastery ?? 0;

      return {
        topicKey: topic.key,
        title: topic.title,
        mastery,
        concern: topic.weight * (1 - mastery),
      };
    })
    .sort((a, b) => b.concern - a.concern)
    .slice(0, limit);
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
