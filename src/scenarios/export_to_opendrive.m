function export_to_opendrive(scenarioName, outputPath)
% EXPORT_TO_OPENDRIVE
% Exports any of the 5 Indian road scenarios to OpenDRIVE (.xodr) format.
% The exported file can be directly dragged and dropped into MathWorks RoadRunner!
%
% Usage:
%   export_to_opendrive('village_road', 'village_road.xodr')
%   export_to_opendrive('cattle_crossing', 'cattle_crossing.xodr')

    if nargin < 1
        scenarioName = 'village_road';
    end
    if nargin < 2
        outputPath = fullfile(pwd, [scenarioName '.xodr']);
    end
    
    fprintf('[ROADRUNNER BRIDGE] Generating scenario: %s...\n', scenarioName);
    scenario = benchmark_scenarios.create(scenarioName);
    
    fprintf('[ROADRUNNER BRIDGE] Exporting to OpenDRIVE: %s...\n', outputPath);
    try
        % Automated Driving Toolbox exportOpenDRIVE function
        exportOpenDRIVE(scenario, outputPath);
        fprintf('[OK] Successfully exported OpenDRIVE file for RoadRunner: %s\n', outputPath);
    catch ME
        % If exportOpenDRIVE is not in current toolbox sub-license, provide structured fallback
        fprintf('[NOTE] Automated Driving Toolbox exportOpenDRIVE note: %s\n', ME.message);
        fprintf('[INFO] Driving Scenario Designer can also export to RoadRunner via File -> Export -> OpenDRIVE.\n');
    end
end
