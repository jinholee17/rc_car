#pragma once
#include <WiFiS3.h>

void car_init();
void car_loop();
void car_handleRequest(const String &path, WiFiClient &client);