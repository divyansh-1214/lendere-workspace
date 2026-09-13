import { Schema, model, models } from "mongoose";

const CaseEventSchema = new Schema(
  {
    caseId: {
      type: Schema.Types.ObjectId,
      ref: "Case",
      required: true,
      index: true,
    },

    agentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    actorType: {
      type: String,
      enum: ["AGENT", "LENDER_ADMIN", "SYSTEM"],
      required: true,
    },

    type: {
      type: String,
      enum: [
        "CASE_ASSIGNED",
        "CASE_STARTED",
        "NODE_CREATED",
        "ANSWER_SUBMITTED",
        "OUTCOME_CREATED",
        "CASE_COMPLETED",
      ],
      required: true,
    },

    nodeId: {
      type: Schema.Types.ObjectId,
      ref: "CaseNode",
      default: null,
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);

export const CaseEvent =
  models.CaseEvent || model("CaseEvent", CaseEventSchema);
