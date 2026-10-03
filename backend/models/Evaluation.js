const { Schema, model } = require("mongoose");

const evaluationSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", index: true }, // used in Part 2
    candidate: { type: Schema.Types.Mixed, required: true },
    github: Schema.Types.Mixed,
    scores: Schema.Types.Mixed,
    potential: Schema.Types.Mixed,
    ai: Schema.Types.Mixed,
    recommendation: String,
    matchedKeywords: [String],
    warnings: [String],
    evaluatedAt: Date
  },
  { timestamps: true }
);

evaluationSchema.set("toJSON", {
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = model("Evaluation", evaluationSchema);