const util = require('util');
const ERR = require('async-stacktrace');
const express = require('express');
const asyncHandler = require('express-async-handler');
const router = express.Router();

const error = require('@prairielearn/prairielib/error');
const assessment = require('../../lib/assessment');
const studentAssessmentInstance = require('../shared/studentAssessmentInstance');
const sqldb = require('@prairielearn/prairielib/sql-db');
const sqlLoader = require('@prairielearn/prairielib/sql-loader');

const sql = sqlLoader.loadSqlEquiv(__filename);

router.post('/', function(req, res, next) {
    if (res.locals.assessment.type !== 'Exam') return next();
    if (!res.locals.authz_result.authorized_edit) return next(error.make(403, 'Not authorized', res.locals));

    if (req.body.__action == 'attach_file') {
        util.callbackify(studentAssessmentInstance.processFileUpload)(req, res, function(err) {
            if (ERR(err, next)) return;
            res.redirect(req.originalUrl);
        });
    } else if (req.body.__action == 'attach_text') {
        util.callbackify(studentAssessmentInstance.processTextUpload)(req, res, function(err) {
            if (ERR(err, next)) return;
            res.redirect(req.originalUrl);
        });
    } else if (req.body.__action == 'delete_file') {
        util.callbackify(studentAssessmentInstance.processDeleteFile)(req, res, function(err) {
            if (ERR(err, next)) return;
            res.redirect(req.originalUrl);
        });
    } else if (['grade', 'finish', 'timeLimitFinish'].includes(req.body.__action)) {
        const overrideGradeRate = false;
        var closeExam;
        if (req.body.__action == 'grade') {
            if (!res.locals.assessment.allow_real_time_grading) {
                next(error.make(403, 'Real-time grading is not allowed for this assessment'));
                return;
            }
            closeExam = false;
        } else if (req.body.__action == 'finish') {
            closeExam = true;
        } else if (req.body.__action == 'timeLimitFinish') {
            closeExam = true;
        } else {
            next(error.make(400, 'unknown __action', {locals: res.locals, body: req.body}));
        }
        assessment.gradeAssessmentInstance(res.locals.assessment_instance.id, res.locals.authn_user.user_id, closeExam, overrideGradeRate, function(err) {
            if (ERR(err, next)) return;
            if (req.body.__action == 'timeLimitFinish') {
                res.redirect(req.originalUrl + '?timeLimitExpired=true');
            } else {
                res.redirect(req.originalUrl);
            }
        });
    } else {
        next(error.make(400, 'unknown __action', {locals: res.locals, body: req.body}));
    }
});

router.get('/', asyncHandler(async (req, res, next) => {
    if (res.locals.assessment.type !== 'Exam') return next();

    const params = {assessment_instance_id: res.locals.assessment_instance.id};
    const result = await sqldb.queryAsync(sql.select_instance_questions, params);
    res.locals.instance_questions = result.rows;
    res.locals.assessment_text_templated = assessment.renderHtmlOrText(res.locals.assessment, res.locals.urlPrefix);
    res.locals.showTimeLimitExpiredModal = (req.query.timeLimitExpired == 'true');
    res.locals.savedAnswers = 0;
    res.locals.suspendedSavedAnswers = 0;
    res.locals.instance_questions.forEach((question) => {
        if (question.status == 'saved') {
            if (question.allow_grade_left_ms > 0) {
                res.locals.suspendedSavedAnswers++;
            } else {
                res.locals.savedAnswers++;
            }
        }
    });
    
    res.render(__filename.replace(/\.js$/, '.ejs'), res.locals);
}));

module.exports = router;
