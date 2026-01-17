/**
 * Home Page Hooks
 */

// Re-export consolidated dashboard hook from shared worker hooks
export { useWorkerDashboard, useInvalidateWorkerDashboard } from '../../hooks';

// Page-specific hooks
export { useHomeCalculations } from './useHomeCalculations';
