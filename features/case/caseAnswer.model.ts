import mongoose, { Schema, model, models } from "mongoose";

const CaseAnswerSchema = new Schema(
  {
    caseId: {
      type: Schema.Types.ObjectId,
      ref: "Case",
      required: true,
      index: true,
    },

    nodeId: {
      type: Schema.Types.ObjectId,
      ref: "WorkflowNode",
      required: true,
      index: true,
    },

    agentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    answer: {
      value: {
        type: Schema.Types.Mixed,
        required: true,
      },

      label: {
        type: String,
        default: null,
      },
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export const CaseAnswer =
  models.CaseAnswer || model("CaseAnswer", CaseAnswerSchema);
