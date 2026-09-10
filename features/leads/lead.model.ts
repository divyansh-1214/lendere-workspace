import mongoose, { Schema, Model } from "mongoose";

// ============================================================
// TYPES
// ============================================================

export interface ILeads {
  _doc_id?: string;
  personal: {
    firstName: string;
    lastName: string;
    age: number;
    nickname?: string | null;
    fatherName?: string | null;
    motherName?: string | null;
    dob?: Date | null;
    gender?: "male" | "female" | "other" | null;
    maritalStatus?: string | null;
    numberOfKids?: number | null;
    preferredLanguage?: string | null;
  };

  contact: {
    phone: string;
    personalEmail?: string | null;
    officialEmail?: string | null;
  };

  addresses: {
    type: "current" | "permanent" | "other";
    addressLine1: string;
    addressLine2?: string | null;
    city?: string | null;
    state?: string | null;
    pinCode?: string | null;
  }[];

  employment: {
    type?:
      | "salaried"
      | "self_employed"
      | "business"
      | "student"
      | "unemployed"
      | "other"
      | null;
    companyName?: string | null;
    workExperience?: number | null;
    income?: number | null;
  };

  credit: {
    creditScore?: number | null;
    crifScore?: number | null;
    crifScoreSource?: string | null;
    crifScoreUpdatedAt?: Date | null;
  };

  loan: {
    amount?: number | null;
    purpose?: string | null;
    status?: string | null;
  };

  identification: {
    pan?: string | null;
  };

  application: {
    appInstanceId?: string | null;
  };

  attribution: {
    source?: string | null;
    medium?: string | null;
    campaign?: string | null;
    term?: string | null;
    gadSource?: string | null;
    gadCampaignId?: string | null;
    gclid?: string | null;
  };

  metadata: {
    sourceDocumentId?: string | null;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date | null;
  };
}

// ============================================================
// ADDRESS SCHEMA
// ============================================================

const AddressSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["current", "permanent", "other"],
      default: "other",
    },

    addressLine1: {
      type: String,
      required: true,
      trim: true,
    },

    addressLine2: {
      type: String,
      default: null,
      trim: true,
    },

    city: {
      type: String,
      default: null,
      trim: true,
    },

    state: {
      type: String,
      default: null,
      trim: true,
    },

    pinCode: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    _id: false,
  }
);

// ============================================================
// BORROWER SCHEMA
// ============================================================

const LeadsSchema = new Schema<ILeads>(
  {
    // ----------------------------------------------------------
    // PERSONAL INFORMATION
    // ----------------------------------------------------------
    _doc_id: {
      type: String,
      required: true,
      trim: true,
    },
    personal: {
      firstName: {
        type: String,
        required: true,
        trim: true,
      },

      lastName: {
        type: String,
        required: true,
        trim: true,
      },

      age: {
        type: Number,
        required: true,
        min: 0,
        max: 150,
      },

      nickname: {
        type: String,
        default: null,
        trim: true,
      },

      fatherName: {
        type: String,
        default: null,
        trim: true,
      },

      motherName: {
        type: String,
        default: null,
        trim: true,
      },

      dob: {
        type: Date,
        default: null,
      },

      gender: {
        type: String,
        enum: ["male", "female", "other"],
        default: null,
      },

      maritalStatus: {
        type: String,
        default: null,
        trim: true,
      },

      numberOfKids: {
        type: Number,
        default: null,
        min: 0,
      },

      preferredLanguage: {
        type: String,
        default: "hi",
        trim: true,
      },
    },

    // ----------------------------------------------------------
    // CONTACT INFORMATION
    // ----------------------------------------------------------

    contact: {
      phone: {
        type: String,
        required: true,
        trim: true,
      },

      personalEmail: {
        type: String,
        default: null,
        lowercase: true,
        trim: true,
      },

      officialEmail: {
        type: String,
        default: null,
        lowercase: true,
        trim: true,
      },
    },

    // ----------------------------------------------------------
    // ADDRESSES
    // ----------------------------------------------------------

    addresses: {
      type: [AddressSchema],
      default: [],
    },

    // ----------------------------------------------------------
    // EMPLOYMENT
    // ----------------------------------------------------------

    employment: {
      type: {
        type: String,
        required: true,
        enum: [
          "salaried",
          "self_employed",
          "business",
          "student",
          "unemployed",
          "other",
        ],
        default: null,
      },

      companyName: {
        type: String,
        default: null,
        trim: true,
      },

      workExperience: {
        type: Number,
        default: null,
        min: 0,
      },

      income: {
        type: Number,
        default: null,
        min: 0,
      },
    },

    // ----------------------------------------------------------
    // CREDIT PROFILE
    // ----------------------------------------------------------

    credit: {
      creditScore: {
        type: Number,
        required: true,
        default: null,
        min: 0,
        max: 900,
      },

      crifScore: {
        type: Number,
        default: null,
        min: 0,
        max: 900,
      },

      crifScoreSource: {
        type: String,
        default: null,
        trim: true,
      },

      crifScoreUpdatedAt: {
        type: Date,
        default: null,
      },
    },

    // ----------------------------------------------------------
    // LOAN INFORMATION
    // ----------------------------------------------------------

    loan: {
      amount: {
        type: Number,
        default: null,
        min: 0,
      },

      purpose: {
        type: String,
        default: null,
        trim: true,
      },

      status: {
        type: String,
        default: null,
        trim: true,
      },
    },

    // ----------------------------------------------------------
    // IDENTIFICATION
    // ----------------------------------------------------------

    identification: {
      pan: {
        type: String,
        default: null,
        uppercase: true,
        trim: true,
      },
    },

    // ----------------------------------------------------------
    // APPLICATION / DEVICE
    // ----------------------------------------------------------

    application: {
      appInstanceId: {
        type: String,
        default: null,
        trim: true,
      },
    },

    // ----------------------------------------------------------
    // MARKETING / ATTRIBUTION
    // ----------------------------------------------------------

    attribution: {
      source: {
        type: String,
        default: null,
        trim: true,
      },

      medium: {
        type: String,
        default: null,
        trim: true,
      },

      campaign: {
        type: String,
        default: null,
        trim: true,
      },

      term: {
        type: String,
        default: null,
        trim: true,
      },

      gadSource: {
        type: String,
        default: null,
        trim: true,
      },

      gadCampaignId: {
        type: String,
        default: null,
        trim: true,
      },

      gclid: {
        type: String,
        default: null,
        trim: true,
      },
    },

    // ----------------------------------------------------------
    // SYSTEM METADATA
    // ----------------------------------------------------------

    metadata: {
      sourceDocumentId: {
        type: String,
        default: null,
        trim: true,
      },

      active: {
        type: Boolean,
        default: true,
      },

      createdAt: {
        type: Date,
        default: Date.now,
      },

      updatedAt: {
        type: Date,
        default: Date.now,
      },

      deletedAt: {
        type: Date,
        default: null,
      },
    },
  },

  // ============================================================
  // SCHEMA OPTIONS
  // ============================================================

  {
    timestamps: true,
    versionKey: false,
  }
);

// ============================================================
// INDEXES
// ============================================================

// Useful for finding borrowers
LeadsSchema.index({ "contact.phone": 1 });
LeadsSchema.index({ "identification.pan": 1 });
LeadsSchema.index({ "contact.personalEmail": 1 });

// Useful for active borrowers
LeadsSchema.index({ "metadata.active": 1 });

// ============================================================
// EXPORT MODEL
// ============================================================

// Prevent model recompilation error in Next.js
const Leads: Model<ILeads> =
  mongoose.models.Leads ||
  mongoose.model<ILeads>("Leads", LeadsSchema);

export default Leads  ;
