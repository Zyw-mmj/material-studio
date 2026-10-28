package com.example.material.task;

import org.apache.ibatis.annotations.*;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface TaskMapper {
    @Select("SELECT * FROM generation_tasks WHERE id=#{id} AND user_id=#{userId}")
    TaskRow owned(@Param("id") String id, @Param("userId") String userId);

    @Select("SELECT * FROM generation_tasks WHERE id=#{id}")
    TaskRow find(String id);

    @Select("SELECT * FROM generation_tasks WHERE id=#{id} FOR UPDATE")
    TaskRow lock(String id);

    @Select("SELECT * FROM generation_tasks WHERE user_id=#{userId} AND client_request_id=#{key}")
    TaskRow byRequest(@Param("userId") String userId, @Param("key") String key);

    @Insert(
            "INSERT INTO"
                + " generation_tasks(id,user_id,template_id,template_title,template_snapshot,client_request_id,request_hash,simulation_json,status,version,created_at,updated_at)"
                + " VALUES(#{id},#{userId},#{templateId},#{templateTitle},#{templateSnapshot},#{clientRequestId},#{requestHash},#{simulationJson},'QUEUED',0,#{createdAt},#{updatedAt})")
    void insert(TaskRow row);

    @Insert(
            "INSERT INTO task_assets(task_id,user_id,asset_id,position)"
                    + " VALUES(#{taskId},#{userId},#{assetId},#{position})")
    void input(
            @Param("taskId") String taskId,
            @Param("userId") String userId,
            @Param("assetId") String assetId,
            @Param("position") int position);

    @Insert(
            "INSERT INTO task_steps(task_id,step_name,step_order,status)"
                    + " VALUES(#{id},#{step},#{order},'PENDING')")
    void step(@Param("id") String id, @Param("step") String step, @Param("order") int order);

    @Select("SELECT * FROM task_steps WHERE task_id=#{id} ORDER BY step_order")
    List<StepRow> steps(String id);

    @Select(
            "SELECT a.id AS asset_id, t.position, a.storage_key, a.mime_type, a.size_bytes,"
                + " a.sha256 FROM task_assets t JOIN assets a ON a.id=t.asset_id AND"
                + " a.user_id=t.user_id WHERE t.task_id=#{id} ORDER BY t.position")
    List<TaskInput> inputs(String id);

    List<TaskRow> list(
            @Param("userId") String userId,
            @Param("status") String status,
            @Param("templateId") String templateId,
            @Param("time") LocalDateTime time,
            @Param("cursorId") String cursorId,
            @Param("limit") int limit);

    @Update(
            "UPDATE generation_tasks SET"
                + " status='RUNNING',current_step='VALIDATE',started_at=#{now},updated_at=#{now},version=version+1"
                + " WHERE id=#{id} AND status='QUEUED'")
    int claim(@Param("id") String id, @Param("now") LocalDateTime now);

    @Update(
            "UPDATE task_steps SET status='RUNNING',started_at=#{now} WHERE task_id=#{id} AND"
                    + " step_name=#{step} AND status='PENDING'")
    int startStep(
            @Param("id") String id, @Param("step") String step, @Param("now") LocalDateTime now);

    @Update(
            "UPDATE task_steps SET status='SUCCEEDED',finished_at=#{now} WHERE task_id=#{id} AND"
                    + " step_name=#{step} AND status='RUNNING'")
    int finishStep(
            @Param("id") String id, @Param("step") String step, @Param("now") LocalDateTime now);

    @Update(
            "UPDATE generation_tasks SET current_step=#{step},updated_at=#{now},version=version+1"
                + " WHERE id=#{id} AND status='RUNNING'")
    void progress(
            @Param("id") String id, @Param("step") String step, @Param("now") LocalDateTime now);

    @Update(
            "UPDATE generation_tasks SET"
                + " status='SUCCEEDED',result_key=#{key},result_mime_type=#{mime},result_size_bytes=#{size},updated_at=#{now},finished_at=#{now},version=version+1"
                + " WHERE id=#{id} AND status='RUNNING'")
    void complete(
            @Param("id") String id,
            @Param("key") String key,
            @Param("mime") String mime,
            @Param("size") long size,
            @Param("now") LocalDateTime now);

    @Update(
            "UPDATE task_steps SET"
                + " status='FAILED',finished_at=#{now},error_code=#{code},error_message=#{message}"
                + " WHERE task_id=#{id} AND status='RUNNING'")
    void failStep(
            @Param("id") String id,
            @Param("code") String code,
            @Param("message") String message,
            @Param("now") LocalDateTime now);

    @Update("UPDATE task_steps SET status='SKIPPED' WHERE task_id=#{id} AND status='PENDING'")
    void skipSteps(String id);

    @Update(
            "UPDATE generation_tasks SET"
                + " status='FAILED',error_code=#{code},error_message=#{message},finished_at=#{now},updated_at=#{now},version=version+1"
                + " WHERE id=#{id} AND status IN ('QUEUED','RUNNING')")
    void fail(
            @Param("id") String id,
            @Param("code") String code,
            @Param("message") String message,
            @Param("now") LocalDateTime now);

    @Select(
            "SELECT id FROM generation_tasks WHERE status IN ('QUEUED','RUNNING') ORDER BY id LIMIT"
                + " 100")
    List<String> unfinished();
}
