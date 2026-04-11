#!/bin/bash
# A small script to split council.ts into readable chunks
split -l 150 packages/server/src/services/council.ts /tmp/council_part_
