import { Schema, model, models } from "mongoose";

const CaseSchema = new Schema(
  {
    leadId: {
      type: Schema.Types.ObjectId,
      ref: "Leads",
      required: true,
      index: true,
    },

    lenderId: {
      type: Schema.Types.ObjectId,
      ref: "Lender",
      required: true,
      index: true,
    },

    agentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    lenderAdminId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    workflowId: {
      type: Schema.Types.ObjectId,
      ref: "Workflow",
      default: null,
      index: true,
    },

    currentNodeId: {
      type: Schema.Types.ObjectId,
      ref: "WorkflowNode",
      default: null,
      index: true,
    },

    status: {
      type: String,
      enum: [
        "ASSIGNED",
        "IN_PROGRESS",
        "COMPLETED",
        "REJECTED",
        "CANCELLED",
      ],
      default: "ASSIGNED",
      required: true,
      index: true,
    },

    assignedAt: {
      type: Date,
      default: Date.now,
    },

    startedAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

CaseSchema.index({ lenderId: 1, leadId: 1 }, { unique: true });

export const Case = models.Case || model("Case", CaseSchema);
export default Case;
