import mongoose, { Schema, model, models } from "mongoose";

const WorkflowNodeSchema = new Schema(
  {
    workflowId: {
      type: Schema.Types.ObjectId,
      ref: "Workflow",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["QUESTION", "OUTCOME"],
      required: true,
    },

    question: {
      text: {
        type: String,
        required: function () {
          return this.type === "QUESTION";
        },
      },

      answerType: {
        type: String,
        enum: [
          "TEXT",
          "NUMBER",
          "BOOLEAN",
          "SINGLE_SELECT",
          "MULTI_SELECT",
        ],
      },

      options: [
        {
          value: {
            type: String,
          },

          label: {
            type: String,
          },
        },
      ],
    },

    outcome: {
      code: {
        type: String,
      },

      label: {
        type: String,
      },

      status: {
        type: String,
        enum: ["APPROVED", "REJECTED", "MANUAL_REVIEW"],
      },
    },

    parentId: {
      type: Schema.Types.ObjectId,
      ref: "WorkflowNode",
      default: null,
      index: true,
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

export const WorkflowNode =
  models.WorkflowNode || model("WorkflowNode", WorkflowNodeSchema);
