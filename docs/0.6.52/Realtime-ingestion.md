---
layout: doc_page
---
Realtime Data Ingestion
========

Realtime data ingestion uses [Realtime nodes](Realtime.html) to index data and make it immediately available for querying. This data is periodically handed off (in the form of data segments) to  [Historical](Historical.html) nodes, after which that data is forgotten by the Realtime nodes. This handoff, or "segment propagation," involves a series of interactions between various members of the Druid cluster. It is illustrated below.

Much of the configuration governing Realtime nodes and the ingestion of data is set in the Realtime spec file, discussed on this page.


Segment Propagation
-------------------

The segment propagation diagram for real-time data ingestion can be seen below:

![Segment Propagation](../img/segmentPropagation.png "Segment Propagation")

You can read about the various components shown in this diagram under the Architecture section (see the menu on the left).

<a id="realtime-specfile"></a>
## Realtime "specFile"

The property `druid.realtime.specFile` has the path of a file (absolute or relative path and file name) with realtime specifications in it. This "specFile" should be a JSON Array of JSON objects like the following:

```json
[
  {
    "schema": {
      "dataSource": "dataSourceName",
      "aggregators": [
        {
          "type": "count",
          "name": "events"
        },
        {
          "type": "doubleSum",
          "name": "outColumn",
          "fieldName": "inColumn"
        }
      ],
      "indexGranularity": "minute",
      "shardSpec": {
        "type": "none"
      }
    },
    "config": {
      "maxRowsInMemory": 500000,
      "intermediatePersistPeriod": "PT10m"
    },
    "firehose": {
      "type": "kafka-0.7.2",
      "consumerProps": {
        "zk.connect": "zk_connect_string",
        "zk.connectiontimeout.ms": "15000",
        "zk.sessiontimeout.ms": "15000",
        "zk.synctime.ms": "5000",
        "groupid": "consumer-group",
        "fetch.size": "1048586",
        "autooffset.reset": "largest",
        "autocommit.enable": "false"
      },
      "feed": "your_kafka_topic",
      "parser": {
        "timestampSpec": {
          "column": "timestamp",
          "format": "iso"
        },
        "data": {
          "format": "json"
        },
        "dimensionExclusions": [
          "value"
        ]
      }
    },
    "plumber": {
      "type": "realtime",
      "windowPeriod": "PT10m",
      "segmentGranularity": "hour",
      "basePersistDirectory": "\/tmp\/realtime\/basePersist"
    }
  }
]
```

This is a JSON Array so you can give more than one realtime stream to a given node. The number you can put in the same process depends on the exact configuration. In general, it is best to think of each realtime stream handler as requiring 2-threads: 1 thread for data consumption and aggregation, 1 thread for incremental persists and other background tasks.

There are four parts to a realtime stream specification, `schema`, `config`, `firehose` and `plumber` which we will go into here.

### Schema

This describes the data schema for the output Druid segment. More information about concepts in Druid and querying can be found at [Concepts-and-Terminology](Concepts-and-Terminology.html) and [Querying](Querying.html).

|Field|Type|Description|Required|
|-----|----|-----------|--------|
|aggregators|Array of Objects|The list of aggregators to use to aggregate colliding rows together.|yes|
|dataSource|String|The name of the dataSource that the segment belongs to.|yes|
|indexGranularity|String|The granularity of the data inside the segment. E.g. a value of "minute" will mean that data is aggregated at minutely granularity. That is, if there are collisions in the tuple (minute(timestamp), dimensions), then it will aggregate values together using the aggregators instead of storing individual rows.|yes|
|segmentGranularity|String|The granularity of the segment as a whole. This is generally larger than the index granularity and describes the rate at which the realtime server will push segments out for historical servers to take over.|yes|
|shardSpec|Object|This describes the shard that is represented by this server. This must be specified properly in order to have multiple realtime nodes indexing the same data stream in a sharded fashion.|no|

### Config

This provides configuration for the data processing portion of the realtime stream processor.

|Field|Type|Description|Required|
|-----|----|-----------|--------|
|intermediatePersistPeriod|ISO8601 Period String|The period that determines the rate at which intermediate persists occur. These persists determine how often commits happen against the incoming realtime stream. If the realtime data loading process is interrupted at time T, it should be restarted to re-read data that arrived at T minus this period.|yes|
|maxRowsInMemory|Number|The number of rows to aggregate before persisting. This number is the post-aggregation rows, so it is not equivalent to the number of input events, but the number of aggregated rows that those events result in. This is used to manage the required JVM heap size.|yes|

### Firehose

See [Firehose](Firehose.html).

### Plumber

See [Plumber](Plumber.html)

Constraints
-----------

The following table summarizes constraints between settings in the spec file for the Realtime subsystem.

|Name|Effect|Minimum|Recommended|
|----|------|-------|-----------|
| windowPeriod| when reading an InputRow, events with timestamp older than now minus this window are discarded | time jitter tolerance | use this to reject outliers |
| segmentGranularity| time granularity (minute, hour, day, week, month) for loading data at query time | equal to indexGranularity| more than indexGranularity|
| indexGranularity| time granularity (minute, hour, day, week, month) of indexes | less than segmentGranularity| minute, hour, day, week, month |
| intermediatePersistPeriod| the max real time (ISO8601 Period) between flushes of InputRows from memory to disk | avoid excessive flushing | number of un-persisted rows in memory also constrained by maxRowsInMemory |
| maxRowsInMemory| the max number of InputRows to hold in memory before a flush to disk | number of un-persisted post-aggregation rows in memory is also constrained by intermediatePersistPeriod | use this to avoid running out of heap if too many rows in an intermediatePersistPeriod |

The normal, expected use cases have the following overall constraints: `indexGranularity < intermediatePersistPeriod =< windowPeriod  < segmentGranularity`

If the RealtimeNode process runs out of heap, try adjusting druid.computation.buffer.size property which specifies a size in bytes that must fit into the heap.



Extending the code
------------------

Realtime integration is intended to be extended in two ways:

1.  Connect to data streams from varied systems ([Firehose](https://github.com/druid-io/druid-api/blob/master/src/main/java/io/druid/data/input/FirehoseFactory.java))
2.  Adjust the publishing strategy to match your needs ([Plumber](https://github.com/metamx/druid/blob/master/server/src/main/java/io/druid/segment/realtime/plumber/PlumberSchool.java))

The expectations are that the former will be very common and something that users of Druid will do on a fairly regular basis. Most users will probably never have to deal with the latter form of customization. Indeed, we hope that all potential use cases can be packaged up as part of Druid proper without requiring proprietary customization.

Given those expectations, adding a firehose is straightforward and completely encapsulated inside of the interface. Adding a plumber is more involved and requires understanding of how the system works to get right, it???s not impossible, but it???s not intended that individuals new to Druid will be able to do it immediately.
