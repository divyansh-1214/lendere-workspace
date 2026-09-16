import mongoose from "mongoose";
import { User } from "@/features/users/user.model";
import { connectDB } from "@/lib/db";
import Case from "@/features/case/case.model";

export default async function registerCase(
  leadIds: string[],
  currentUser: any,
) {
  await connectDB();
  const session = await mongoose.startSession();
  try {
    for (const leadId of leadIds) {
      await session!.withTransaction(async () => {
        const agent = await User.findOneAndUpdate(
          {
            lenderId: currentUser.lenderId,
            role: "lender_agent",
            status: "active",
          },
          {
            $inc: {
              numberOfAssignedLeads: 1,
            },
          },
          {
            sort: {
              numberOfAssignedLeads: 1,
              numberOfCompletedLeads: -1,
            },
            returnDocument: "after",
            session,
          },
        );

        if (!agent) {
          throw new Error("No active agents available");
        }

        await Case.create(
          [
            {
              leadId,
              lenderId: currentUser.lenderId,
              agentId: agent._id,
              lenderAdminId: currentUser._id,
              status: "ASSIGNED",
              assignedAt: new Date(),
            },
          ],
          { session },
        );
      });
    }
    return { success: true, message: "Case registered successfully" };
  } catch (error) {
    console.error("Error registering case:", error);
    return { success: false, message: "Error registering case" };
  }finally {
    await session.endSession();
  }
}
