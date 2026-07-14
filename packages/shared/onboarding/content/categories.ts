import { TrainingCategorySchema, type TrainingCategory } from "./schema";

/** ONB-TASK-012 AC-012-01: seven categories, `build`/`automation` flagged
 * post-v1 (available when those engines ship, ADR-006). */
const categories: TrainingCategory[] = [
  { categoryId: "introduction", labelKey: "onboarding.training.category.introduction", availability: "shipped" },
  { categoryId: "ontologies", labelKey: "onboarding.training.category.ontologies", availability: "shipped" },
  { categoryId: "graph-explorer", labelKey: "onboarding.training.category.graph-explorer", availability: "shipped" },
  { categoryId: "build", labelKey: "onboarding.training.category.build", availability: "post-v1" },
  { categoryId: "automation", labelKey: "onboarding.training.category.automation", availability: "post-v1" },
  {
    categoryId: "compliance-governance",
    labelKey: "onboarding.training.category.compliance-governance",
    availability: "shipped",
  },
  { categoryId: "administration", labelKey: "onboarding.training.category.administration", availability: "shipped" },
];

export const TRAINING_CATEGORIES: TrainingCategory[] = categories.map((c) => TrainingCategorySchema.parse(c));
