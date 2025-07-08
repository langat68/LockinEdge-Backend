import { Hono } from "hono";
import { ResumeController } from "./resume.controller.js";

const router = new Hono({ strict: false });

router.post("/", ResumeController.upload);
router.get("/", ResumeController.list);
router.get("/:id", ResumeController.getById);
router.put("/:id", ResumeController.update);

export default router;
