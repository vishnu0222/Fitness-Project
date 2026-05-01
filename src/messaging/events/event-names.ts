export const EventNames = {
  AuthUserSignedUp: 'auth.user.signed_up',
  AuthUserSignedIn: 'auth.user.signed_in',
  ChallengeCreated: 'challenge.created',
  ChallengeUpdated: 'challenge.updated',
  ChallengeDeleted: 'challenge.deleted',
  ChallengeJoined: 'challenge.joined',
  ChallengeLeft: 'challenge.left',
  ChallengeProgressUpdated: 'challenge.progress_updated',

  WorkoutPlanCreated: 'workout.plan.created',
  WorkoutPlanUpdated: 'workout.plan.updated',
  WorkoutPlanDeleted: 'workout.plan.deleted',
} as const;

export type EventName = typeof EventNames[keyof typeof EventNames];
