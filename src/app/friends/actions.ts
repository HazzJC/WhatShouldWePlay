"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAccountUser() {
  const user = await getCurrentUser();

  if (!user?.username) {
    redirect("/account?returnTo=%2Ffriends");
  }

  return user;
}

export async function sendFriendRequestAction(formData: FormData) {
  const user = await requireAccountUser();
  const recipientId = String(formData.get("recipientId") ?? "");

  if (!recipientId || recipientId === user.id) {
    throw new Error("Choose another user.");
  }

  const [recipient, blocked, existingFriend, recentRequests] = await Promise.all([
    prisma.user.findFirst({
      where: { id: recipientId, directoryVisible: true, username: { not: null } },
      select: { id: true },
    }),
    prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: user.id, blockedId: recipientId },
          { blockerId: recipientId, blockedId: user.id },
        ],
      },
      select: { id: true },
    }),
    prisma.userFriend.findUnique({
      where: { userId_friendId: { userId: user.id, friendId: recipientId } },
      select: { id: true },
    }),
    prisma.friendRequest.count({
      where: {
        senderId: user.id,
        createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) },
      },
    }),
  ]);

  if (!recipient || blocked) {
    throw new Error("That profile is not available.");
  }

  if (existingFriend) {
    throw new Error("You are already friends.");
  }

  if (recentRequests >= 20) {
    throw new Error("Friend request limit reached. Try again later.");
  }

  const reverseRequest = await prisma.friendRequest.findUnique({
    where: { senderId_recipientId: { senderId: recipientId, recipientId: user.id } },
  });

  if (reverseRequest?.status === "PENDING") {
    await acceptRequest(user.id, reverseRequest.id);
  } else {
    await prisma.friendRequest.upsert({
      where: { senderId_recipientId: { senderId: user.id, recipientId } },
      create: { senderId: user.id, recipientId },
      update: { status: "PENDING", createdAt: new Date() },
    });
  }

  revalidatePath("/friends");
}

export async function respondFriendRequestAction(formData: FormData) {
  const user = await requireAccountUser();
  const requestId = String(formData.get("requestId") ?? "");
  const response = String(formData.get("response") ?? "");

  if (response === "accept") {
    await acceptRequest(user.id, requestId);
  } else if (response === "decline") {
    await prisma.friendRequest.updateMany({
      where: { id: requestId, recipientId: user.id, status: "PENDING" },
      data: { status: "DECLINED" },
    });
  }

  revalidatePath("/friends");
}

async function acceptRequest(recipientId: string, requestId: string) {
  const request = await prisma.friendRequest.findFirst({
    where: { id: requestId, recipientId, status: "PENDING" },
  });

  if (!request) {
    throw new Error("Friend request not found.");
  }

  await prisma.$transaction([
    prisma.friendRequest.update({
      where: { id: request.id },
      data: { status: "ACCEPTED" },
    }),
    prisma.userFriend.upsert({
      where: { userId_friendId: { userId: request.senderId, friendId: request.recipientId } },
      create: { userId: request.senderId, friendId: request.recipientId },
      update: {},
    }),
    prisma.userFriend.upsert({
      where: { userId_friendId: { userId: request.recipientId, friendId: request.senderId } },
      create: { userId: request.recipientId, friendId: request.senderId },
      update: {},
    }),
  ]);
}

export async function cancelFriendRequestAction(formData: FormData) {
  const user = await requireAccountUser();
  const requestId = String(formData.get("requestId") ?? "");

  await prisma.friendRequest.updateMany({
    where: { id: requestId, senderId: user.id, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
  revalidatePath("/friends");
}

export async function removeFriendAction(formData: FormData) {
  const user = await requireAccountUser();
  const friendId = String(formData.get("friendId") ?? "");

  await prisma.userFriend.deleteMany({
    where: {
      OR: [
        { userId: user.id, friendId },
        { userId: friendId, friendId: user.id },
      ],
    },
  });
  revalidatePath("/friends");
}

export async function blockUserAction(formData: FormData) {
  const user = await requireAccountUser();
  const blockedId = String(formData.get("userId") ?? "");

  if (!blockedId || blockedId === user.id) {
    throw new Error("Choose another user.");
  }

  await prisma.$transaction([
    prisma.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId: user.id, blockedId } },
      create: { blockerId: user.id, blockedId },
      update: {},
    }),
    prisma.userFriend.deleteMany({
      where: {
        OR: [
          { userId: user.id, friendId: blockedId },
          { userId: blockedId, friendId: user.id },
        ],
      },
    }),
    prisma.friendRequest.deleteMany({
      where: {
        OR: [
          { senderId: user.id, recipientId: blockedId },
          { senderId: blockedId, recipientId: user.id },
        ],
      },
    }),
  ]);
  revalidatePath("/friends");
}
