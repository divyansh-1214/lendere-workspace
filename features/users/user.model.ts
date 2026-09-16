import mongoose, { Schema, Document, Types } from "mongoose";

export type UserRole =
  | "ops_admin"
  | "lender_admin"
  | "lender_agent";

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash?: string;

  role: UserRole;

  lenderId?: Types.ObjectId;

  status: "invited" | "active" | "disabled";

  numberOfAssignedLeads: number;
  numberOfCompletedLeads: number;
  
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    passwordHash: {
      type: String,
      select: false,
    },

    role: {
      type: String,
      enum: [
        "ops_admin",
        "lender_admin",
        "lender_agent",
      ],
      required: true,
    },

    lenderId: {
      type: Schema.Types.ObjectId,
      ref: "Lender",
      index: true,
    },

    status: {
      type: String,
      enum: [
        "invited",
        "active",
        "disabled",
      ],
      default: "invited",
    },
    numberOfAssignedLeads: {
      type: Number,
      default: 0,
    },
    numberOfCompletedLeads: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

export const User =
  mongoose.models.User ||
  mongoose.model<IUser>("User", UserSchema);

export default User;