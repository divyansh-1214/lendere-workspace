import { Schema, model, models } from "mongoose";

const CaseNodeSchema = new Schema(
  {
    caseId: {
      type: Schema.Types.ObjectId,
      ref: "Case",
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

    parentId: {
      type: Schema.Types.ObjectId,
      ref: "CaseNode",
      default: null,
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
        default: null,
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
        default: null,
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

    answer: {
      value: {
        type: Schema.Types.Mixed,
        default: null,
      },

      label: {
        type: String,
        default: null,
      },
    },

    outcome: {
      code: {
        type: String,
        default: null,
      },

      label: {
        type: String,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

export  const CaseNode =
  models.CaseNode || model("CaseNode", CaseNodeSchema);
export default CaseNode;
