import mongoose, { Schema, model, models } from "mongoose";

const WorkflowSchema = new Schema(
  {
    lenderId: {
      type: Schema.Types.ObjectId,
      ref: "Lender",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: null,
      trim: true,
    },

    version: {
      type: Number,
      required: true,
      default: 1,
    },

    status: {
      type: String,
      enum: ["DRAFT", "ACTIVE", "ARCHIVED"],
      default: "DRAFT",
      required: true,
      index: true,
    },

    startNodeId: {
      type: Schema.Types.ObjectId,
      ref: "WorkflowNode",
      default: null,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "LenderAdmin",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Workflow =
  models.Workflow || model("Workflow", WorkflowSchema);
