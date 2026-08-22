import {
  siCaldotcom,
  siDevdotto,
  siGithub,
  siGooglescholar,
  siStandardresume,
  siSubstack,
  siX,
  siXing,
  siYoutube,
} from "simple-icons";

const linkedinPath =
  "M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.03-1.85-3.03-1.85 0-2.14 1.44-2.14 2.94v5.66H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45Z";
const mailPath =
  "M1.5 8.67v8.58a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3V8.67l-8.928 5.493a3 3 0 0 1-3.144 0L1.5 8.67Z M22.5 6.908V6.75a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3v.158l9.714 5.978a1.5 1.5 0 0 0 1.572 0L22.5 6.908Z";

export const profileIconPaths: Record<string, string> = {
  github: siGithub.path,
  linkedin: linkedinPath,
  x: siX.path,
  youtube: siYoutube.path,
  substack: siSubstack.path,
  devto: siDevdotto.path,
  scholar: siGooglescholar.path,
  xing: siXing.path,
  "standard-resume": siStandardresume.path,
  cal: siCaldotcom.path,
  email: mailPath,
};
