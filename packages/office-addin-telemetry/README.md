# Office-Addin-telemetry
This package allows for sending telemetry event and exception data to the selected telemetry infrastructure (e.g. ApplicationInsights).


## Command-Line Interface
* [Start](#Start)
* [Stop](#Stop)
* [List](#List)

#

### Start
Sets telemetry level to verbose for the specific telemetry group.

Syntax:

`start <telemetry-group-name>`

Options:

`-f --filepath`

Optional filepath that user can specify where the json object changes will be kept.

#

### Stop
Sets telemetry level to basic for the specific telemetry group.

Syntax:

`stop <telemetry-group-name>`

Options:

`-f --filepath`

Optional filepath that user can specify where the json object changes will be kept.

### List
List out all the telemetry groups in the telemetry config file.

Syntax:

`list`

Options:

`-f --filepath`

Optional filepath that user can specify for telemetry config file.