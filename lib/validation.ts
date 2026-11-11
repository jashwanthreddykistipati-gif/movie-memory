import { z } from "zod";

export const movieSchema = z
  .string()
  .trim()
  .min(2, "Movie title must be at least 2 characters")
  .max(100, "Movie title must be at most 100 characters");