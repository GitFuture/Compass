

DEFINES += DISPLAY_LIBRARY
include(./libdisplayqml.pri)
TEMPLATE = lib

_LIBDISPLAYQML_MAJOR_VER = 1
_LIBDISPLAYQML_MINOR_VER = 15
_LIBDISPLAYQML_PATCH_VER = 1

win32: VERSION = $$_LIBDISPLAYQML_MAJOR_VER"."$$_LIBDISPLAYQML_MINOR_VER"."$$_LIBDISPLAYQML_PATCH_VER".0"
else:  VERSION = $$_LIBDISPLAYQML_MAJOR_VER"."$$_LIBDISPLAYQML_MINOR_VER"."$$_LIBDISPLAYQML_PATCH_VER

QT += core gui widgets
CONFIG += c++11

DEFINES += _LIBDISPLAYQML_MAJOR_VER=$$_LIBDISPLAYQML_MAJOR_VER \
           _LIBDISPLAYQML_MINOR_VER=$$_LIBDISPLAYQML_MINOR_VER \
           _LIBDISPLAYQML_PATCH_VER=$$_LIBDISPLAYQML_PATCH_VER

DESTDIR = $$PWD/bin/lib
android {
contains(ANDROID_TARGET_ARCH,x86) {
    DESTDIR = $$PWD/bin/android-x86-lib
} else : contains(ANDROID_TARGET_ARCH,armeabi-v7a) {
    DESTDIR = $$PWD/bin/android-v7a-lib
}
}
CONFIG(debug, debug|release) {
    TARGET = QmlCompassd
} else {
    TARGET = QmlCompass
}


# Additional import path used to resolve QML modules in Qt Creator's code model
#QML_IMPORT_PATH =

RESOURCES += dc_qml.qrc dc_res.qrc

INCLUDEPATH += $$PWD/include
DEPENDPATH += .

HEADERS += include/display_global.h \
    include/Animation.h \
    include/LibDisplayQml.h \
    include/AnimationDataObject.h \
    include/DisplayQmlInterface.h

SOURCES += \
    src/Animation.cpp \
    src/LibDisplayQml.cpp

DISTFILES += \
    qml/Button.qml \
    qml/Pitch.qml \
    qml/MySlider.qml \
    qml/DataSource.js \
    qml/gl-matrix.js \
    qml/SpacePath.js \
    qml/Compass.qml \
    qml/ScrollBar.qml \
    qml/SpacePath.qml \
    qml/OBJLoader.js \
    qml/SPVertexCode.vsh \
    qml/SPFragCode.fsh

#RC_FILE = icon.rc
win32: CONFIG += skip_target_version_ext
