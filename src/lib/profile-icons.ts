import {
  siCaldotcom,
  siDevdotto,
  siDribbble,
  siFigma,
  siGithub,
  siGooglescholar,
  siResearchgate,
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
const arenaPath =
  "M6.375 6.371L6.375 17.629L7.875 17.629L7.875 6.371Z M16.125 6.371L16.125 17.629L17.625 17.629L17.625 6.371Z M1.875 9.835L11.625 15.464L12.375 14.165L2.625 8.536Z M2.625 15.464L12.375 9.835L11.625 8.536L1.875 14.165Z M11.625 9.835L21.375 15.464L22.125 14.165L12.375 8.536Z M12.375 15.464L22.125 9.835L21.375 8.536L11.625 14.165Z";
const cosmosPath =
  "M6.796 15.168a1.95 1.95 0 1 0 0.001 0Z M17.205 15.281a1.95 1.95 0 1 0 0.001 0Z M6.796 4.932a1.95 1.95 0 1 0 0.001 0Z M17.205 4.819a1.95 1.95 0 1 0 0.001 0Z M19.548 9.736a1.95 1.95 0 1 0 0.001 0Z M12.001 2.491a1.95 1.95 0 1 0 0.001 0Z M4.452 9.736a1.95 1.95 0 1 0 0.001 0Z M12 17.609a1.95 1.95 0 1 0 0.001 0Z";

export const profileIconPaths: Record<string, string> = {
  github: siGithub.path,
  linkedin: linkedinPath,
  x: siX.path,
  youtube: siYoutube.path,
  substack: siSubstack.path,
  devto: siDevdotto.path,
  scholar: siGooglescholar.path,
  researchgate: siResearchgate.path,
  xing: siXing.path,
  "standard-resume": siStandardresume.path,
  figma: siFigma.path,
  dribbble: siDribbble.path,
  arena: arenaPath,
  cosmos: cosmosPath,
  cal: siCaldotcom.path,
  email: mailPath,
};

