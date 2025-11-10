/**
 * Task Mapping Service
 * Handles extraction of tasks from content and building task mappings
 * Single responsibility: Task extraction and mapping
 */

export class TaskMappingService {
    /**
     * Create a new TaskMappingService instance
     * @param {CPEETaskExtractor} cpeeTaskExtractor - Extractor for CPEE tasks
     * @param {MermaidTaskExtractor} mermaidTaskExtractor - Extractor for Mermaid tasks
     * @param {TaskMapper} taskMapper - Mapper for building task mappings
     */
    constructor(cpeeTaskExtractor, mermaidTaskExtractor, taskMapper) {
        this.cpeeTaskExtractor = cpeeTaskExtractor;
        this.mermaidTaskExtractor = mermaidTaskExtractor;
        this.taskMapper = taskMapper;
    }

    /**
     * Extract tasks and generate task mapping for a step
     * @param {CPEEStep} cpeeStep - Step to process
     * @returns {Object|null} Task mapping or null if no tasks found
     */
    generateTaskMapping(cpeeStep) {
        // Extract tasks from all sections
        const tasks = this.extractTasksFromStep(cpeeStep);
        
        // Generate task mapping if we have tasks
        if (tasks.inputCpeeTasks.length > 0 || tasks.inputMermaidTasks.length > 0 || 
            tasks.outputMermaidTasks.length > 0 || tasks.outputCpeeTasks.length > 0) {
            try {
                const taskMapping = this.taskMapper.buildMapping(
                    tasks.inputCpeeTasks,
                    tasks.inputMermaidTasks,
                    tasks.outputMermaidTasks,
                    tasks.outputCpeeTasks
                );
                cpeeStep.setTaskMapping(taskMapping);
                console.log(`[TaskMappingService] Task mapping generated for Step ${cpeeStep.stepNumber}`);
                return taskMapping;
            } catch (error) {
                console.warn(`[TaskMappingService] Failed to generate task mapping for Step ${cpeeStep.stepNumber}:`, error);
                return null;
            }
        }
        
        return null;
    }

    /**
     * Extract all tasks from a step's content sections
     * @param {CPEEStep} cpeeStep - Step to extract tasks from
     * @returns {Object} Tasks by section
     * @private
     */
    extractTasksFromStep(cpeeStep) {
        // Extractors have static methods - get the class (works with both class and instance)
        const CPEETaskExtractorClass = this.cpeeTaskExtractor.constructor || this.cpeeTaskExtractor;
        const MermaidTaskExtractorClass = this.mermaidTaskExtractor.constructor || this.mermaidTaskExtractor;
        
        const inputCpeeTasks = CPEETaskExtractorClass.extract(
            cpeeStep.getInputCpeeTreeRaw().getContent()
        );
        const inputMermaidTasks = MermaidTaskExtractorClass.extract(
            cpeeStep.getInputMermaidRaw().getContent()
        );
        const outputMermaidTasks = MermaidTaskExtractorClass.extract(
            cpeeStep.getOutputMermaidRaw().getContent()
        );
        const outputCpeeTasks = CPEETaskExtractorClass.extract(
            cpeeStep.getOutputCpeeTreeRaw().getContent()
        );
        
        return {
            inputCpeeTasks,
            inputMermaidTasks,
            outputMermaidTasks,
            outputCpeeTasks
        };
    }
}

