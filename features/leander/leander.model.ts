import mongoose, { Schema, Document, Model } from "mongoose";

export interface ILender extends Document {
  lenderId: string;

  // Basic information
  name: string;
  isActive: boolean;

  // Lead distribution priority
  priority: number;

  // Application / onboarding flow
  flow: "OTP" | "REDIRECT" | "API" | "MANUAL";

  // Eligibility / BRE rules
  eligibility: {
    age: {
      min: number;
      max: number;
    };

    income: {
      minAnnual: number;
    };

    creditScore: {
      minExclusive: number;
      maxInclusive: number;
    };

    employmentTypes: (
      | "salaried"
      | "self_employed"
      | "business"
      | "professional"
    )[];
  };

  // Geographic eligibility
  geography: {
    allPincodes: boolean;
    supportedPincodes: string[];
  };

  // Lead/application limits
  leadLimits: {
    maxLeadsPerDay?: number;
  };

  // Pre-BRE / preflight configuration
  preflight: {
    enabled: boolean;
  };

  // Application behavior
  application: {
    leadOnly: boolean;
    minAppVersion?: string;
  };

  // Offer configuration
  offer: {
    approval?: boolean;
    canShowProvisionalOffer: boolean;
  };

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const LenderSchema = new Schema<ILender>(
  {
    lenderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    priority: {
      type: Number,
      required: true,
      default: 0,
      index: true,
    },

    flow: {
      type: String,
      enum: ["OTP", "REDIRECT", "API", "MANUAL"],
      required: true,
    },

    eligibility: {
      age: {
        min: {
          type: Number,
          required: true,
        },
        max: {
          type: Number,
          required: true,
        },
      },

      income: {
        minAnnual: {
          type: Number,
          required: true,
        },
      },

      creditScore: {
        minExclusive: {
          type: Number,
          required: true,
        },
        maxInclusive: {
          type: Number,
          required: true,
        },
      },

      employmentTypes: [
        {
          type: String,
          enum: [
            "salaried",
            "self_employed",
            "business",
            "professional",
          ],
        },
      ],
    },

    geography: {
      allPincodes: {
        type: Boolean,
        default: false,
      },

      supportedPincodes: {
        type: [String],
        default: [],
        index: true,
      },
    },

    leadLimits: {
      maxLeadsPerDay: {
        type: Number,
      },
    },

    preflight: {
      enabled: {
        type: Boolean,
        default: false,
      },
    },

    application: {
      leadOnly: {
        type: Boolean,
        default: false,
      },

      minAppVersion: {
        type: String,
      },
    },

    offer: {
      approval: {
        type: Boolean,
      },

      canShowProvisionalOffer: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    timestamps: true,
  }
);

const Lender: Model<ILender> =
  mongoose.models.Lender ||
  mongoose.model<ILender>("Lender", LenderSchema);

export default Lender;