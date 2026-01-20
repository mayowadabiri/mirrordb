export const verifyDeviceSchema = {
  body: {
    type: "object",
    required: ["code"],
    properties: {
      code: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        message: { type: "string" },
        data: {
          type: "object",
          properties: {
            token: { type: "string" },
          },
        },
      },
    },
  },
} as const;

export const startDeviceSchema = {
  response: {
    201: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        message: { type: "string" },
        data: {
          type: "object",
          properties: {
            deviceCode: { type: "string" },
            userCode: { type: "string" },
            verificationUrl: { type: "string" },
            expiresAt: { type: "string" },
          },
        },
      },
    },
  },
} as const;
