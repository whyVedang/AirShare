export default class ResumeManager {
  static createResumeRequest(missingChunks) {
    return JSON.stringify({
      type: "resume-request",
      missingChunks
    });
  }

  static parseResumeRequest(msg) {
    return msg.missingChunks || [];
  }
}