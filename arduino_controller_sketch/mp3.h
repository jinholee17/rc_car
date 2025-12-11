#pragma once
#include <WiFiS3.h>

void mp3_init();                        
void mp3_loop();                        
void mp3_handleRequest(const String &path, WiFiClient &client);