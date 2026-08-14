import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const KEY = 'lakshya.lastGoal';

/**
 * The goal the student was last working on.
 *
 * The header tabs used to read the goal straight out of the URL, so stepping
 * into Groups — which has no goal in its path — made "Study plan" and "Ask a
 * doubt" disappear, with no way back except the dashboard. Remembering the last
 * goal keeps those tabs pointing somewhere sensible wherever you are.
 */
export function useLastGoal() {
  const { goalId } = useParams();
  const [remembered, setRemembered] = useState(() => localStorage.getItem(KEY));

  useEffect(() => {
    if (goalId && goalId !== remembered) {
      localStorage.setItem(KEY, goalId);
      setRemembered(goalId);
    }
  }, [goalId, remembered]);

  return goalId ?? remembered ?? null;
}

/** Called when a goal is deleted, so the tabs stop pointing at something gone. */
export function forgetLastGoal(goalId) {
  if (!goalId || localStorage.getItem(KEY) === goalId) {
    localStorage.removeItem(KEY);
  }
}
