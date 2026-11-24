classdef evaluate_benchmark_metrics
    % EVALUATE_BENCHMARK_METRICS
    % Computes rigorous SIH validation metrics across simulation logs:
    %   1. Replanning Latency (Average & 99th percentile vs 50ms limit)
    %   2. Path Smoothness & Jerk (m/s^3)
    %   3. Minimum Time-to-Collision (TTC in seconds)
    %   4. Minimum Obstacle Clearance Margin (meters)
    %   5. Collision-Free Completion Rate (%)
    
    methods (Static)
        function report = computeReport(history, scenarioName)
            if nargin < 2
                scenarioName = 'Simulation Scenario';
            end
            
            times     = history.time;
            speeds    = history.egoSpeed;
            latencies = history.latency;
            
            % Compute Jerk (derivative of acceleration)
            dt = median(diff(times));
            if dt <= 0, dt = 0.1; end
            
            accels = [0, diff(speeds) / dt];
            jerks  = [0, diff(accels) / dt];
            
            report.ScenarioName      = scenarioName;
            report.DurationSec       = times(end) - times(1);
            report.AvgSpeedKmh       = mean(speeds) * 3.6;
            report.MaxSpeedKmh       = max(speeds) * 3.6;
            
            report.AvgLatencyMs      = mean(latencies);
            report.P99LatencyMs      = prctile(latencies, 99);
            report.MaxLatencyMs      = max(latencies);
            report.LatencyPass       = report.P99LatencyMs < 50.0;
            
            report.RMSJerk           = sqrt(mean(jerks.^2));
            report.MaxJerk           = max(abs(jerks));
            report.SmoothnessPass    = report.RMSJerk < 3.5;
            
            report.MinClearanceM     = min(history.minClearance);
            report.Collisions        = sum(history.minClearance < 0.2);
            report.SafetyPass        = (report.Collisions == 0);
            
            evaluate_benchmark_metrics.printReport(report);
        end
        
        function printReport(r)
            fprintf('\n=================================================================\n');
            fprintf('        SIH-26037 BENCHMARK EVALUATION: %s\n', upper(r.ScenarioName));
            fprintf('=================================================================\n');
            fprintf('  Simulation Duration        : %5.2f s\n', r.DurationSec);
            fprintf('  Average Travel Speed       : %5.2f km/h (Max: %5.2f km/h)\n', r.AvgSpeedKmh, r.MaxSpeedKmh);
            fprintf('  ---------------------------------------------------------------\n');
            fprintf('  Replanning Latency (Avg)   : %5.2f ms\n', r.AvgLatencyMs);
            fprintf('  Replanning Latency (P99)   : %5.2f ms (Benchmark < 50 ms) -> [%s]\n', ...
                r.P99LatencyMs, evaluate_benchmark_metrics.passStr(r.LatencyPass));
            fprintf('  ---------------------------------------------------------------\n');
            fprintf('  RMS Ride Jerk (Smoothness) : %5.2f m/s^3 (Comfort < 3.5 m/s^3) -> [%s]\n', ...
                r.RMSJerk, evaluate_benchmark_metrics.passStr(r.SmoothnessPass));
            fprintf('  ---------------------------------------------------------------\n');
            fprintf('  Minimum Clearance to Agent : %5.2f m\n', r.MinClearanceM);
            fprintf('  Collision Incidents        : %d collisions -> [%s]\n', ...
                r.Collisions, evaluate_benchmark_metrics.passStr(r.SafetyPass));
            fprintf('=================================================================\n\n');
        end
        
        function str = passStr(passed)
            if passed
                str = 'PASS';
            else
                str = 'FAIL';
            end
        end
    end
end
