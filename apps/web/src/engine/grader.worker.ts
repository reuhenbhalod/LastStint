// Grading worker: counts a decision moment's (or an Expert rival's) successes per option off
// the render thread (gradeMessage.ts).
import { type GradeRequest, answerGradeRequest } from './gradeMessage.js';

self.onmessage = (e: MessageEvent<GradeRequest>) => {
  self.postMessage(answerGradeRequest(e.data));
};
