// Built-in exercise library. IDs are fixed so two devices seeding the list never create duplicates.
// type: 'weight' = lb × reps, 'bodyweight' = reps (optional added lb), 'time' = timed hold
// rest: default rest timer in seconds

const LIST = [
  // Chest
  ['Bench Press (Barbell)', 'weight', 'Chest', 180],
  ['Incline Bench Press (Barbell)', 'weight', 'Chest', 150],
  ['Bench Press (Dumbbell)', 'weight', 'Chest', 120],
  ['Incline Press (Dumbbell)', 'weight', 'Chest', 120],
  ['Chest Press (Machine)', 'weight', 'Chest', 90],
  ['Chest Fly (Cable)', 'weight', 'Chest', 60],
  ['Push-up', 'bodyweight', 'Chest', 60],
  ['Dip', 'bodyweight', 'Chest', 90],
  // Back
  ['Deadlift', 'weight', 'Back', 180],
  ['Barbell Row', 'weight', 'Back', 120],
  ['Dumbbell Row', 'weight', 'Back', 90],
  ['Lat Pulldown', 'weight', 'Back', 90],
  ['Seated Cable Row', 'weight', 'Back', 90],
  ['Pull-up', 'bodyweight', 'Back', 120],
  ['Chin-up', 'bodyweight', 'Back', 120],
  ['Face Pull', 'weight', 'Back', 60],
  // Legs
  ['Squat (Barbell)', 'weight', 'Legs', 180],
  ['Front Squat', 'weight', 'Legs', 180],
  ['Romanian Deadlift', 'weight', 'Legs', 150],
  ['Leg Press', 'weight', 'Legs', 120],
  ['Hip Thrust', 'weight', 'Legs', 120],
  ['Bulgarian Split Squat', 'weight', 'Legs', 90],
  ['Walking Lunge', 'weight', 'Legs', 90],
  ['Leg Extension', 'weight', 'Legs', 60],
  ['Leg Curl', 'weight', 'Legs', 60],
  ['Calf Raise', 'weight', 'Legs', 60],
  // Shoulders
  ['Overhead Press (Barbell)', 'weight', 'Shoulders', 150],
  ['Shoulder Press (Dumbbell)', 'weight', 'Shoulders', 120],
  ['Lateral Raise', 'weight', 'Shoulders', 60],
  ['Rear Delt Fly', 'weight', 'Shoulders', 60],
  // Arms
  ['Barbell Curl', 'weight', 'Arms', 60],
  ['Dumbbell Curl', 'weight', 'Arms', 60],
  ['Hammer Curl', 'weight', 'Arms', 60],
  ['Triceps Pushdown', 'weight', 'Arms', 60],
  ['Skull Crusher', 'weight', 'Arms', 60],
  ['Overhead Triceps Extension', 'weight', 'Arms', 60],
  // Core
  ['Plank', 'time', 'Core', 60],
  ['Hanging Leg Raise', 'bodyweight', 'Core', 60],
  ['Cable Crunch', 'weight', 'Core', 60],
  ['Ab Wheel Rollout', 'bodyweight', 'Core', 60],
];

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export const SEED_EXERCISES = LIST.map(([name, type, group, rest]) => ({
  id: 'ex_' + slug(name), name, type, group, rest, builtIn: true,
}));
