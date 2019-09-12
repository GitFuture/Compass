#-------------------------------------------------
#
# Project created by QtCreator 2019-06-18T20:29:46
#
#-------------------------------------------------

QT       += core gui

include($$(DISPLAYER_DIR)/libdisplayqml.pri)
#include($$(BASICCOMMDIR)/BasicComm.pri)
include($$(BUILIB_DIR)/BuiLib.pri)

greaterThan(QT_MAJOR_VERSION, 4): QT += widgets

TARGET = QMLDataTransfer
TEMPLATE = app
#CONFIG += console

VERSION=1.0.8.0
DEFINES += _QMLDT_MAJ_VER=1 _QMLDT_MIN_VER=0
RC_ICONS = ./compass.ico

# The following define makes your compiler emit warnings if you use
# any feature of Qt which as been marked as deprecated (the exact warnings
# depend on your compiler). Please consult the documentation of the
# deprecated API in order to know how to port your code away from it.
DEFINES += QT_DEPRECATED_WARNINGS

# You can also make your code fail to compile if you use deprecated APIs.
# In order to do so, uncomment the following line.
# You can also select to disable deprecated APIs only up to a certain version of Qt.
#DEFINES += QT_DISABLE_DEPRECATED_BEFORE=0x060000    # disables all the APIs deprecated before Qt 6.0.0


SOURCES += main.cpp\
    DataTransfer.cpp \
    MainWindow.cpp

HEADERS  += \
    DataTransfer.h \
    MainWindow.h

FORMS    += MainWindow.ui

RESOURCES += \
    res.qrc

win32: CONFIG += skip_target_version_ext
DESTDIR = $$OUT_PWD/app
