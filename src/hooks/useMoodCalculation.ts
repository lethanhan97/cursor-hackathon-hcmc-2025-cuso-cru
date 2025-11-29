import * as faceapi from "@vladmandic/face-api";

export type Mood =
  | "angry"
  | "disgusted"
  | "fearful"
  | "happy"
  | "neutral"
  | "sad"
  | "surprised";

type FaceDetectionWithExpressions = {
  expressions: faceapi.FaceExpressions;
};

type MoodCalculationInput = {
  detections: FaceDetectionWithExpressions[] | null;
  voiceScore: number; // Range: -5 to 5
  transcript: string;
  recentMoods: Mood[];
  windowSize: number;
};

type MoodCalculationResult = {
  calculatedMood: Mood;
  smoothedMood: Mood;
  moodCount: number;
  shouldUpdate: boolean;
  sfx?: Sfx;
};

type Sfx = "crazy" | "party" | "boom";

const SFX_WORDS_THRESHOLD = 1;

// Pure function to calculate mood from face detections and voice score
function calculateMoodFromInputs(
  detections: FaceDetectionWithExpressions[],
  voiceScore: number
): Mood {
  // Define emotion categories
  const positiveEmotions: Mood[] = ["happy", "surprised"];
  const negativeEmotions: Mood[] = ["angry", "sad", "disgusted", "fearful"];

  // Get all expressions from all detected faces with their probabilities
  const allExpressions = detections.flatMap(({ expressions }) => {
    return Object.entries(expressions).map(([expression, probability]) => ({
      expression: expression as Mood,
      probability: probability as number,
    }));
  });

  // Calculate weighted scores for each mood based on face detection
  const moodScores: Record<Mood, number> = {
    angry: 0,
    disgusted: 0,
    fearful: 0,
    happy: 0,
    neutral: 0,
    sad: 0,
    surprised: 0,
  };

  // Aggregate probabilities from all faces
  allExpressions.forEach(({ expression, probability }) => {
    if (expression in moodScores) {
      moodScores[expression] = Math.max(moodScores[expression], probability);
    }
  });

  let finalMood: Mood = "neutral";
  const voiceWeight = Math.abs(voiceScore) > 3 ? 0.7 : 0.3; // Higher weight if voice is strong
  const faceWeight = 1 - voiceWeight;

  if (voiceScore > 3) {
    // Strong positive voice - prioritize positive emotions
    const positiveMoods = positiveEmotions
      .map((mood) => ({
        mood,
        score: moodScores[mood] * faceWeight + voiceWeight,
      }))
      .filter((m) => moodScores[m.mood] > 0);

    if (positiveMoods.length > 0) {
      finalMood = positiveMoods.reduce((max, current) =>
        current.score > max.score ? current : max
      ).mood;
    } else {
      // Fallback to most likely face emotion
      finalMood = Object.entries(moodScores).reduce((max, [mood, score]) => {
        const maxScore = moodScores[max as Mood];
        return score > maxScore ? (mood as Mood) : (max as Mood);
      }, "neutral" as Mood) as Mood;
    }
  } else if (voiceScore < -3) {
    // Strong negative voice - prioritize negative emotions
    const negativeMoods = negativeEmotions
      .map((mood) => ({
        mood,
        score: moodScores[mood] * faceWeight + voiceWeight,
      }))
      .filter((m) => moodScores[m.mood] > 0);

    if (negativeMoods.length > 0) {
      finalMood = negativeMoods.reduce((max, current) =>
        current.score > max.score ? current : max
      ).mood;
    } else {
      // Fallback to most likely face emotion
      finalMood = Object.entries(moodScores).reduce((max, [mood, score]) => {
        const maxScore = moodScores[max as Mood];
        return score > maxScore ? (mood as Mood) : (max as Mood);
      }, "neutral" as Mood) as Mood;
    }
  } else {
    // Neutral voice - use face detection as primary
    finalMood = Object.entries(moodScores).reduce((max, [mood, score]) => {
      const maxScore = moodScores[max as Mood];
      return score > maxScore ? (mood as Mood) : (max as Mood);
    }, "neutral" as Mood) as Mood;
  }

  return finalMood;
}

function calculateSfx(transcript: string): Sfx | undefined {
  const lastNwords = transcript
    .split(" ")
    .slice(-SFX_WORDS_THRESHOLD)
    .join(" ");

  if (lastNwords.includes("crazy")) {
    return "crazy";
  }

  if (lastNwords.includes("party")) {
    return "party";
  }

  const boomKeywords = ["boom", "awesome"];
  if (boomKeywords.some((keyword) => lastNwords.includes(keyword))) {
    return "boom";
  }

  return undefined;
}

// Pure function to smooth moods using sliding window
function smoothMood(
  calculatedMood: Mood,
  recentMoods: Mood[]
): { smoothedMood: Mood; moodCount: number } {
  // Count occurrences of each mood in the recent window
  const moodCounts = recentMoods.reduce((acc, mood) => {
    acc[mood] = (acc[mood] || 0) + 1;
    return acc;
  }, {} as Record<Mood, number>);

  // Find the mood that appears most frequently
  const smoothedMood = Object.entries(moodCounts).reduce(
    (max, [mood, count]) => {
      return count > (moodCounts[max] || 0) ? (mood as Mood) : max;
    },
    calculatedMood as Mood
  );

  const moodCount = moodCounts[smoothedMood] || 0;

  return { smoothedMood, moodCount };
}

// Pure function to calculate mood
export function calculateMood(
  input: MoodCalculationInput,
  currentMood: Mood | null,
  threshold: number
): MoodCalculationResult {
  const { detections, voiceScore, recentMoods, windowSize } = input;

  if (!detections || detections.length === 0) {
    return {
      calculatedMood: "neutral",
      smoothedMood: currentMood || "neutral",
      moodCount: 0,
      shouldUpdate: false,
    };
  }

  // Type assertion to ensure detections are properly typed
  const typedDetections = detections as FaceDetectionWithExpressions[];

  // Calculate mood from face and voice
  const calculatedMood = calculateMoodFromInputs(typedDetections, voiceScore);
  const sfx = calculateSfx(input.transcript);

  // Add to recent moods window (this is handled outside as it's state)
  const updatedRecentMoods = [...recentMoods, calculatedMood].slice(
    -windowSize
  );

  // Smooth the mood
  const { smoothedMood, moodCount } = smoothMood(
    calculatedMood,
    updatedRecentMoods
  );

  // Determine if we should update
  const shouldUpdate =
    !currentMood || (smoothedMood !== currentMood && moodCount >= threshold);

  return {
    calculatedMood,
    smoothedMood,
    moodCount,
    shouldUpdate,
    sfx,
  };
}
