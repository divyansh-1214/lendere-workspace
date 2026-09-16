import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, publicUser, requireRole } from "@/lib/auth";
import mongoose from "mongoose";
import {User} from "@/features/users/user.model";
import { connectDB } from "@/lib/db";
import Case from "@/features/case/case.model";
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getAuthenticatedUser(request);
    if (!currentUser || !requireRole(currentUser, ["lender_admin"])) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }
    const lenderId = currentUser.lenderId;
    console.log(lenderId)
    const body = await request.json();
    const leadIds: string[] = body.leadId;
    connectDB();
    const session = await mongoose.startSession();
    await session.withTransaction(async () => {
    try{
      const agents = await User.find({ lenderId, role: "lender_agent", status: "active" })
      .select("_id numberOfAssignedLeads numberOfCompletedLeads")
      .sort({ numberOfAssignedLeads: 1, numberOfCompletedLeads: -1 });

      for(let i = 0; i < leadIds.length; i++){
        const leadId = leadIds[i];
        const agent = agents[i % agents.length];
        const assignment = await Case.create({
          leadId,
          lenderId: currentUser.lenderId,
          agentId: agent._id,
          lenderAdminId: currentUser._id,
          status: "ASSIGNED",
          assignedAt: new Date(),
        },{session});
        console.log(assignment)
      }
      console.log(agents)
    }catch(error){
      console.log(error)
    }
    finally {
      await session.endSession();
    }});
    console.log(leadIds)
    return NextResponse.json({ success: true, lenderId }, { status: 200 });
  } catch (error) {
    console.log(error)
    return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ message: "", success: true })
}
