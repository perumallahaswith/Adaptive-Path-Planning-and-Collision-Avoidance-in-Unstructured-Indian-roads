function visualize_scenario(scenarioName)
% VISUALIZE_SCENARIO Visualizes and runs an Indian Road Scenario
% Usage:
%   visualize_scenario('cattle_crossing')
%   visualize_scenario('village_road')
%   visualize_scenario('intersection')
%   visualize_scenario('highway_merge')
%   visualize_scenario('dense_market')

    if nargin < 1
        scenarioName = 'cattle_crossing';
    end

    % Ensure project directories are on path
    scenarioDir = fileparts(mfilename('fullpath'));
    projectRoot = fileparts(scenarioDir);
    if isempty(projectRoot), projectRoot = pwd; end
    addpath(genpath(projectRoot));

    allScenarios = create_indian_road_scenarios();
    
    if ~isfield(allScenarios, scenarioName)
        error('Scenario "%s" not found. Available: village_road, intersection, highway_merge, dense_market, cattle_crossing', scenarioName);
    end
    
    scenario = allScenarios.(scenarioName);
    
    % Create Visualization Figure
    fig = figure('Name', ['SIH-26037: ' scenarioName], 'Position', [100 100 1000 650]);
    plot(scenario);
    title(['Scenario: ' upper(strrep(scenarioName, '_', ' ')) ' (Simulation in Progress)']);
    
    % Run simulation loop
    restart(scenario);
    while advance(scenario)
        pause(scenario.SampleTime);
    end
    fprintf('[OK] Simulation finished for scenario: %s\n', scenarioName);
end
