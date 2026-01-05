import { Request, Response } from "express";
import verifyToken from "./jwtVerification";

export const verifyOriginAndJWT = (
  req: Request,
  email: string,
  userId: string
) => {
  let validOrigin = true;

  let validJWT = false;
  const token = req.headers.authorization?.replace("Bearer ", "").trim();
  const isJwtValid = verifyToken(`${token}`, email, userId);
  if (isJwtValid) {
    validJWT = true;
  }

  if (validOrigin === true && validJWT === true) {
    return true;
  } else {
    return false;
  }
};
