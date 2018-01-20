﻿/******************************
  filename: SpacePath.js
  feature:  绘制 3D 动态图形
  author:   brifuture
  date:     2017.04.10
  Last Update :  2018.01.03, seperate each object into different reign whose ratation
        and transparation is controlled by itself.
*******************************/

Qt.include("gl-matrix.js");
Qt.include("webgl-obj-loader.min.js");

var canvasArgs; // 相关绘图变量

/**
  * UI initializing
**/
function initUI() {
    selectDrawMode(lineRB);
    argItem.ball_radius = 4.0;
    argItem.cam_dis     = 18.0;
    argItem.cam_theta   = 70;
    argItem.cam_beta    = 50;
    argItem.path_gap    = 1;
    argItem.point_size  = 0.3;
    argItem.path_width  = 3;
    argItem.ball_alpha  = 0.65;
    argItem.enable_path = false;
    argItem.calibration = false;
    argItem.enable_sim  = false;
    canvasArgs = argItem;

    axisBox.checked = false;
    selectDrawMode(surfaceRB);
}

function selectDrawMode(mode) {
    for(var cbi in drawMode.children) {
        drawMode.children[cbi].checked = false;
    }

    mode.checked      = true;
    ballAlpha.enabled = ( mode !== lineRB);
    argItem.draw_mode  = mode.text;
}

// some problem occurred when cam_x or cam_y equals to zero
function rotateCamera(argItem) {
    var pos = calcVertex(degToRad(argItem.cam_theta), degToRad(argItem.cam_beta), argItem.cam_dis);
    argItem.cam_x = pos[0];
    argItem.cam_y = pos[1];
    argItem.cam_z = pos[2];
}

function mouseDraged() {
    var xoffset = (mouseListener.mouseX - mouseListener.lpx)*2 / container.width;
    var yoffset = (mouseListener.mouseY - mouseListener.lpy)*2 / container.height;
    var beta = 540 + argItem.cam_beta - xoffset*360; // - indicates that drag direction is oppsite with movement
    argItem.cam_beta   = beta % 360 - 180;
    argItem.cam_theta -= yoffset*180;
    if( argItem.cam_theta.toFixed(2) == 0.00 ) {
        argItem.cam_theta = 0.01;
    }
    if( argItem.cam_theta.toFixed(2) == 180.00 ) {
        argItem.cam_theta = 179.99
    }
    rotateCamera(argItem);
}

function reset(argItem) {
    argItem.heading_offset = argItem.heading;
    var angle = calcAngle(argItem.pitch, 0);
    var u = angle[0], v = angle[1];
    resetAllPath();
}

function resetAllPath() {
    obj.sensorPath.resetAllPath();
}

function record() {
    obj.recordPoint.record(canvasArgs);
}

function resetRecord() {
    obj.recordPoint.reset();
}

/******************** end of UI init *****************************/



/******************** start of GL ********************************/
/* 保存画布上下文 */
var gl;
var gl2d;  // this is used for HUD drawing

var width = 0;
var height = 0;

var attributes = {};  // attribute variables from shader
var uniforms = {};    // uniform variables from shader

// matrixs
var pMatrix   = mat4.create();
var vMatrix   = mat4.create();
var pvMatrix  = mat4.create();
var mvpMatrix = mat4.create();
var nMatrix   = mat4.create();

var obj = {};

function initializeGL(canvas) {
    gl  = canvas.getContext("canvas3d",
                           { depth: true, antilias: true }
                           );
    gl2d = canvas.getContext("2d");
    gl.enable(gl.DEPTH_TEST);  // depth test
    gl.depthFunc(gl.LESS);
    gl.enable(gl.CULL_FACE); // 设置遮挡剔除有效
    gl.cullFace(gl.BACK);
    gl.clearColor(0.97, 0.97, 0.97, 1.0);  // background color
    gl.clearDepth(1.0);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.enable(gl.BLEND);   // enable blend for alpha
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    initShaders();
    initBuffers();
}

function resizeGL(canvas) {
    var pixelRatio = canvas.devicePixelRatio;
    canvas.pixelSize = Qt.size(canvas.width * pixelRatio, canvas.height * pixelRatio);
}

function initShaders() {
    var vertexCode =
        'attribute vec3 aVertexPosition;\n'  +
        'attribute vec3 aVertexNormal;\n'    +
        'attribute vec2 aTexture;\n'         +
        'attribute vec3 aColor;\n'           +
        'uniform highp mat4 uPMVMatrix;\n'   +
        'uniform highp mat4 uMMatrix;\n'     +
        'uniform vec3  uLightDirection;\n'   + // 直射光的方向
        'varying vec3  vLight;\n'            +
        'varying vec2  vTexture;\n'          +
        'void main(void) {\n'                +
        '  gl_Position = uPMVMatrix * vec4(aVertexPosition, 1.0);\n'      +
        '  highp vec3 ambientLight = vec3(0.28, 0.28, 0.28);\n'           +
        '  highp vec3 directionalLightColor = vec3(0.51, 0.55, 0.52);\n'  +
        '  highp float directional = max(dot(aVertexNormal, normalize(uLightDirection)), 0.0);\n' +        // 直接使用顶点的法线数据进行漫反射计算
        '  vLight = aColor * (ambientLight + (directionalLightColor * directional));\n'  +
        '}\n';
    var vertexShader = getShader(gl, vertexCode, gl.VERTEX_SHADER);

    var fragCode =
        'varying vec3  vLight;\n'         +
        'varying vec2  vTexture;'         +
        'uniform float uAlpha;\n'         +
        // 'uniform sampler2D uXSampler;\n'  +
        // 'uniform sampler2D uYSampler;\n'  +
        // 'uniform sampler2D uZSampler;\n'  +
        // 'uniform int uEnableTexture;\n'   +
        'uniform vec4 uFragColor;\n'      +
        'void main(void) {\n'             +
        '  gl_FragColor = vec4(vLight, uAlpha);\n'  +
        // '  mediump vec4 xtextureColor = texture2D(uXSampler, vec2(vXTexture.s, vXTexture.t));\n' +
        // '  mediump vec4 ytextureColor = texture2D(uYSampler, vec2(vXTexture.s, vXTexture.t));\n' +
        // '  mediump vec4 ztextureColor = texture2D(uZSampler, vec2(vXTexture.s, vXTexture.t));\n' +
        // '  if( uEnableTexture == 0 ) {\n'             +
        // '    gl_FragColor = vec4(vLight, uAlpha);\n'  +
        // '  }\n' +
        // '  else if( uEnableTexture == 1 ) {\n'    +
        // '    gl_FragColor = vec4(vLight, 1.0) * xtextureColor;\n' +
        // '  }\n' +
        // '  else if( uEnableTexture == 2 ) {\n' +
        // '    gl_FragColor = vec4(vLight, 1.0) * ytextureColor;}\n' +
        // '  else if( uEnableTexture == 3 ) {\n' +
        // '    gl_FragColor = vec4(vLight, 1.0) * ztextureColor;\n' +
        // '  }\n' +
        '}\n';
    var fragShader = getShader(gl, fragCode, gl.FRAGMENT_SHADER);

    var shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragShader);
    gl.linkProgram(shaderProgram);
    gl.useProgram(shaderProgram);

    attributes.vertex_position = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    gl.enableVertexAttribArray(attributes.vertex_position);

    attributes.vertex_normal = gl.getAttribLocation(shaderProgram, "aVertexNormal");
    gl.enableVertexAttribArray(attributes.vertex_normal)

    attributes.color = gl.getAttribLocation(shaderProgram, "aColor");
    gl.enableVertexAttribArray(attributes.color);

    attributes.color           = gl.getAttribLocation(shaderProgram, "aColor");

    uniforms.pmv_matrix      = gl.getUniformLocation(shaderProgram, "uPMVMatrix"); // 透视模型视图矩阵
    uniforms.m_matrix        = gl.getUniformLocation(shaderProgram, "uMMatrix")
//    uniforms.normal_matrix = gl.getUniformLocation(shaderProgram, "uNormalMatrix"); // 法线
    uniforms.light_direction = gl.getUniformLocation(shaderProgram, "uLightDirection"); // 光照
    uniforms.alpha           = gl.getUniformLocation(shaderProgram, "uAlpha");
    uniforms.frag_color      = gl.getUniformLocation(shaderProgram, "uFragColor");

}

/**
 * 初始化缓冲数据
 */
function initBuffers() {
    obj.coord       = new Coord();
    obj.sensorPoint = new SensorPoint();
    obj.sensorPath  = new SensorPath();
    obj.refCircle   = new RefCircle();
    obj.recordPoint = new RecordPoint();
    obj.ball        = new Ball();
    obj.craft       = new Craft();

    for(var o in obj) {
        obj[o].init(gl);
    }
}

/**
 * @param {*} type  ELEMENT or ARRAY
 * @param {*} data  数组或 long 型整数
 * @param {*} drawtype  STATIC or DYNAMIC
 */
function createArrayBuffer(type, data, drawtype) {
    var buffer = gl.createBuffer();
    gl.bindBuffer(type, buffer);
    gl.bufferData(type, data, drawtype);
    return buffer;
}


function paintGL(canvas, args) {
    var pixelRatio = canvas.devicePixelRatio;
    var currentWidth = canvas.width * pixelRatio;
    var currentHeight = canvas.height * pixelRatio;

    if (currentWidth !== width || currentHeight !== height) {
        width = canvas.width;
        height = canvas.height;
        gl.viewport(0, 0, width, height);
        mat4.perspective(pMatrix, 45 / 180 * Math.PI, width / height, 0.5, 500.0);
    }

    canvasArgs = args;
    /** 如果 heading 有偏移，应把偏移算上(以复位后的位置作为基准方向) **/
    canvasArgs.heading = canvasArgs.heading - canvasArgs.heading_offset;

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);   // clear color buffer and depth buffer bit
    mat4.lookAt(vMatrix, [canvasArgs.cam_x, canvasArgs.cam_y, canvasArgs.cam_z], [0, 0, 0], [0, 0, 1]);
    mat4.multiply(pvMatrix, pMatrix, vMatrix);

    gl.uniform3fv(uniforms.light_direction, canvasArgs.light_direction);  // where light origins
    /** 开始执行实际的绘图操作，由于开启了 ALPHA BLEND 功能，先绘制球内物体 **/
    for(var o in obj) {
        obj[o].paint(gl, canvasArgs);
    }
}



/*
 * 根据渲染类型返回渲染器
 * @param  gl       gl 对象
 * @param  codestr  渲染程序代码，具体渲染方式
 * @param  type     渲染类型
 * @return  渲染器
 */
function getShader(gl, codestr, type) {
    // 创建渲染器
    var shader = gl.createShader(type);

    gl.shaderSource(shader, codestr);
    // 编译渲染器
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.log("JS:Shader compile failed");
        console.log(gl.getShaderInfoLog(shader));
        return null;
    }
    //    console.log("compile done!");
    return shader;
}

function degToRad(deg) {
    return deg * Math.PI /180;
}

/**
* @param {Number} pitch   range [-90, 90]
* @param {Number} heading range [-180, +180]
*/
function calcAngle(pitch, heading) {
    var u, v;
    if (Math.abs(pitch) <= 90) {
        // 将俯仰角转换成绘图时的 theta 角
        u = (90 - pitch) / 180;
        // 绘图时的 beta 角
        v = heading / 360;
    } else {
        // pitch 绝对值超过 90
        if (pitch > 0) {
            u = (pitch - 90) / 180;
        } else {
            u = (270 + pitch) / 180;
        }
        v = (heading + 180) % 360 / 360;
    }
    //    console.log("u: " + u);
    return [u, -v];
}

/**
* @param {Number} pitch   range [-90, 90]
* @param {Number} heading range [0, 360]
* @returns {Vec3} the angle returned is in unit of rad  vec[0] and vec[1] is in unit of RAD
*/
function calcSensorNormal() {
    var pitch   = canvasArgs.pitch;
    var heading = canvasArgs.heading;
    var u = (90-pitch)/180 * Math.PI;
    var v = heading   /180 * Math.PI;
//    return [u, v, canvasArgs.vector_length];
    return vec3.fromValues(u, v, canvasArgs.vector_length)
}



/**
 * 假设球心即为原点，将球面坐标系转换成平面直角坐标系
 * @param   theta {Rad}     球心到顶点的连线与 Z 轴正方向的夹角为 theta
 * @param   beta  {Rad}     球心到顶点的连线在 xoy 平面上的投影与 X 轴正方向的夹角为 beta
 * @param   r     {Number}  球半径
 * @return      顶点的坐标，用三维数组表示
 */
function calcVertex(theta, beta, r) {
    var st = Math.sin(theta);
    var ct = Math.cos(theta);
    var sb = Math.sin(beta);
    var cb = Math.cos(beta);
    var x  = r * st * cb;
    var y  = r * st * sb;
    var z  = r * ct;
    return [x, y, z];
}

function vectorPos(vec) {
    return calcVertex(vec[0], vec[1], vec[2]);
}

/**
*  @param {Array} vertex  the vertices to rotate around the origin point
*  @param {Number}   theta is in terms of RAD
*  @param {Number}   beta  is in terms of RAD
**/
function rotateVertex(vertex, theta, beta) {
    var v = vec3.create();
    for(var i = 0; i < vertex.length; i+=3) {
        v = vec3.fromValues(vertex[i+0], vertex[i+1], vertex[i+2]);
        vec3.rotateY(v, v, [0, 0, 0], theta);
        vec3.rotateZ(v, v, [0, 0, 0], beta);
        vertex[i+0] = v[0];
        vertex[i+1] = v[1];
        vertex[i+2] = v[2];
    }
//    return vertex;
}

/**
 * calculate circle on the plane xoy with given sides and distance between each vertex and origin point
 * the first vertex lies on X coordinate.
 * Note that the origin point is excluded from the array and the direction of the circle is anti-clock viewed from Z+ to Z-
 * @param   {Number} sides
 * @param   {Number} dis
 * @param   {Number} z       the z coordinate
 * @param   {Number} ninv    non-inv plane
 */
function calcCircle(sides, dis, z, ninv) {
    var vertex = [];
    var angle = Math.PI * 2 / sides;
    var x = 0.0;
    var y = 0.0;
    var i = 0;
    vertex = vertex.concat([x, y, z]);
    for(i = 0; i < sides; i++) {
        x = Math.cos(i * angle) * dis;
        y = Math.sin(i * angle) * dis;
        vertex = vertex.concat([x, y, z]);
    }
    if( !ninv) {
//    vertex = vertex.concat([x, y, z]);
        for(i = 0; i < sides; i++) {
            x = Math.cos(i * angle) * dis;
            y = Math.sin(i * angle) * dis;
            vertex = vertex.concat([x, y, z]);
        }
        vertex = vertex.concat([0.0, 0.0, 0.0]);        // add origin points to form the ratio
    }
    return vertex;
}

/**
*  @param offset {Number}  the bytes of the offset
*/
function updateSubBuffer(type, buffer, offset, data) {
    gl.bindBuffer(type, buffer);
    gl.bufferSubData(type, offset, data);
}

// **************** SensorPoint Object **************** //
function SensorPoint() {
    this.sides    = 24;
    this.vscale   = vec3.fromValues(1.0, 1.0, 1.0);
    // the reason why rotation and then translation is out of expections
    // but if rMatrix is introduced, the result seems good
    this.mMatrix  = mat4.create();
    // now all vertices are calculated by function, no need for rMatrix
//    this.rMatrix  = mat4.create();
    this.buffers  = {};
    this.alpha    = 1.0;
    this.color    = [1.0, 0.0, 0.0];      // default color
    this.inv_color  = [0.0, 1.0, 0.0];
    this.point_size = 1.0;
}

SensorPoint.prototype.init = function(gl) {
    var color   = [];
    this.vertex = calcCircle(this.sides, this.point_size, 4);

    var i = 0;
    for(i = 0; i <= this.sides; i++) {
        color = color.concat(this.color);
    }
    for(i = 0; i <= this.sides; i++) {
        color = color.concat(this.inv_color);
    }

    var index = [];       // sensor point need both sides
    // the positive plane
    index.push(0);
    for (i = 1; i <= this.sides; i++) {
        index.push(i);
    }
    index.push(1);
    // radiu
    index.push(2*this.sides + 1);
    for (i = this.sides*2; i >= this.sides+1; i--) {
        index.push(i);
    }
    index.push(this.sides * 2);

    this.index_count = index.length;

    this.buffers.vertex = createArrayBuffer(gl.ARRAY_BUFFER,         new Float32Array(this.vertex), gl.DYNAMIC_DRAW);
    this.buffers.color  = createArrayBuffer(gl.ARRAY_BUFFER,         new Float32Array(color),       gl.STATIC_DRAW);
    this.buffers.index  = createArrayBuffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(index),        gl.STATIC_DRAW);
}

/**
 * 绘制传感器指向的方向，如果需要记录路径的话，从当前位置开始记录路径
 * @param {*} gl
 * @param {*} u         与 Z 轴正向夹角，范围是[0.0, 1.0]
 * @param {*} v         与 X 轴正向夹角，增大的方向为从 Z 轴正无穷远处向原点看时逆时针方向，范围是[0, 1.0]
 * @param {*} offset    斑点到原点的距离
 * @param {*} radial    是否绘制射线
 */
SensorPoint.prototype.paint = function(gl, addon) {
    var angle = calcSensorNormal();  // vertical of angle
//    var pos = calcVertex(degToRad(90-addon.pitch), degToRad(addon.heading), addon.vector_length);
    if( this.point_size !== addon.point_size ) {
        this.point_size   = addon.point_size || 1;
        this.vertex = calcCircle(this.sides, this.point_size, angle[2]);
        this.theta = 0;
        this.beta  = 0;
//        this.vscale  = vec3.fromValues(this.point_size, this.point_size, this.point_size);
    }
    if( this.theta !== angle[0] || this.beta !== angle[1] || this.dis !== angle[2]) {
        var vertex = new Float32Array(this.vertex);
        if( this.theta !== angle[0] || this.beta !== angle[1] ) {
            rotateVertex(vertex, angle[0], angle[1]);
        }
        if( this.dis !== angle[2] ) {
            this.moveZ(vertex, angle[2]);
        }

        this.theta   = angle[0];
        this.beta    = angle[1];
        this.dis     = angle[2];
        updateSubBuffer(gl.ARRAY_BUFFER, this.buffers.vertex, 0, vertex);
//        mat4.fromZRotation(this.rMatrix,         this.beta);
//        mat4.rotateY(this.rMatrix, this.rMatrix, this.theta);
//        mat4.fromRotationTranslation(this.mMatrix, this.rMatrix, pos);
//        mat4.rotateZ(this.mMatrix, this.mMatrix, this.beta);
//        mat4.rotateY(this.mMatrix, this.mMatrix, this.theta);
    }

//    mat4.scale(mvpMatrix, this.mMatrix, this.vscale);            // scale by pointSize
//    mat4.mul(mvpMatrix, pvMatrix, mvpMatrix);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.color);
    gl.vertexAttribPointer(attributes.color,           3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.vertex);    // normal info
    gl.vertexAttribPointer(attributes.vertex_normal,   3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.vertex);    // vertex info
    gl.vertexAttribPointer(attributes.vertex_position, 3, gl.FLOAT, false, 0, 0);

    gl.uniform1f(uniforms.alpha, this.alpha);          //  set alpha value
    gl.uniformMatrix4fv(uniforms.pmv_matrix, false, pvMatrix);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.index);
    gl.drawElements(gl.TRIANGLE_FAN, this.index_count*0.5, gl.UNSIGNED_SHORT, 0);
    // radial
    if( addon.sensor_radial ) {
        gl.drawElements(gl.TRIANGLE_FAN, this.index_count*0.5, gl.UNSIGNED_SHORT, this.index_count * 0.5 * 2);
    }
}

SensorPoint.prototype.moveZ = function(array, z) {
    for(var i = 0; i < array.length; i+=3) {
        array[i] = z;
    }
}

// ================= SensorPoint Object ======================= //

// ****************  SensorPath Object  **************** //
function SensorPath() {
    this.mMatrix         = mat4.create();
    this.alpha           = 1.0;
    this.all_path_count  = 0;
    this.all_index_count = 0;
    this.cur_path_count  = 0;
    this.cur_index_count = 0;
    this.cur_pi          = 0;  // path index
    this.color           = [0.9, 0.5, 0.2];  // path color
    this.max_path_num    = 4800 * 12;
    this.buffer_path_bytes  = this.max_path_num * 4;  // 4 means the bytes float occupies, 3 means a point contains 3 coordinate
    this.buffer_index_bytes = this.max_path_num * 2;  // 2 means the bytes uint  occupies
    this.path_gap        = 4;       // must equal or greater then 1
    this.pg              = 1;       // path gap count
    this.path_width      = 1.0;
    this.buffers         = {};
}

SensorPath.prototype.init = function(gl) {
    this.last_point = calcSensorNormal();
    this.angle      = this.last_point;
    this.path       = [];
    this.index      = [];

    // path buffer initialization
    this.buffers.path  = [];
    this.buffers.index = [];
    this.buffers.color = [];

    this.createBuffer();
}

/**
 * 绘制路径
**/
SensorPath.prototype.paint = function(gl, addon) {
    if(!addon.enable_path) {
        return;
    }
    var lpos  = vectorPos(this.last_point);
    var angle = calcSensorNormal();  // vertical of angle
    var  pos  = vectorPos(angle);
    var dist  = vec3.dist(lpos, pos);

    if( this.path_width !== addon.path_width ) {
        this.path_width   = addon.path_width || 1.0;
    }

    // angle[2] is vector length
    if( dist > Math.PI * angle[2] * 0.03 ) {
        this.updateBuffer(angle, this.angle);
        this.angle      = angle;
        this.last_point = angle;
    } else {
        var path_gap = Math.floor(addon.path_gap) || this.path_gap;
        if( dist > Math.PI * angle[2] * 0.001 ) {
            this.pg ++;
            this.last_point = angle;
        }
        if( this.pg === path_gap ) {
            this.angle = angle;
        }
        if( this.pg === path_gap+1 ) {
            this.pg = 1;
            this.updateBuffer(angle, this.angle);
            this.angle = angle;
        }
    }
//    if( vec3.dist(lpos, pos) > Math.PI * addon.angle[2] * 0.001 ) {
//        this.updateBuffer(addon.angle, this.last_point);
//        this.last_point = addon.angle;
//    }

    gl.uniform1f(uniforms.alpha, this.alpha);     // set alpha value
//    mat4.identity(this.mMatrix);
    mat4.mul(mvpMatrix, pvMatrix, this.mMatrix);
    gl.uniformMatrix4fv(uniforms.pmv_matrix, false, mvpMatrix);

    // 分批绘制路径
    for(var i = 0; i < this.cur_pi; i++) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.color[i]);     // color buffer
        gl.vertexAttribPointer(attributes.color,           3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.path[i]);    // normal info
        gl.vertexAttribPointer(attributes.vertex_normal,   3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.path[i]);
        gl.vertexAttribPointer(attributes.vertex_position, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.index[i]);
        gl.drawElements(gl.TRIANGLES,     this.max_path_num, gl.UNSIGNED_SHORT, 0);
    }
    if( this.cur_index_count > 0 ) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.color[this.cur_pi]);     // color buffer
        gl.vertexAttribPointer(attributes.color,           3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.path[this.cur_pi]);    // normal info
        gl.vertexAttribPointer(attributes.vertex_normal,   3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.path[this.cur_pi]);
        gl.vertexAttribPointer(attributes.vertex_position, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.index[this.cur_pi]);
        gl.drawElements(gl.TRIANGLES,     this.cur_index_count, gl.UNSIGNED_SHORT, 0);
    }
}

SensorPath.prototype.updateBuffer = function(nangle, langle) {
    var presult = this.getLinearPoint(nangle, langle);
    this.all_path_count  += presult.point.length;
    this.all_index_count += presult.index.length;

//        this.path.push.apply(this.path,   presult.point);
//        this.index.push.apply(this.index, presult.index);
    //  updateSubBuffer(gl.ARRAY_BUFFER,         this.buffers.path[this.cur_pi],  0,  new Float32Array(this.path));
    //  updateSubBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.index[this.cur_pi], 0,  new Uint16Array(this.index));
    updateSubBuffer(gl.ARRAY_BUFFER,         this.buffers.color[this.cur_pi], this.cur_path_count  * 4, new Float32Array(presult.color));
    updateSubBuffer(gl.ARRAY_BUFFER,         this.buffers.path[this.cur_pi],  this.cur_path_count  * 4, new Float32Array(presult.point));
    updateSubBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.index[this.cur_pi], this.cur_index_count * 2, new Uint16Array(presult.index));
    // Note! because the updateSubBuffer() should use the offset as the parameter,
    // the addition of path or index count should be later, or the buffer will be out of its size
    this.cur_path_count  += presult.point.length;
    this.cur_index_count += presult.index.length;

    // when path index count is greater or equal to this.max_path_num, then a new buffer should be realloced
    // and the counter should be reset
    if( this.cur_index_count >= this.max_path_num) {
        this.cur_pi++;
        console.log("Info: [Path] create a new buffer!\n");
        this.createBuffer();
        this.resetCurrentPath();
    }
}

/**
 * 用于绘制路径所需的顶点和索引
 * @param {Array} p     p[0] = theta    p[1] = beta    p[2] = radius
 * @param {Array} lp   lp[0] = theta   lp[1] = beta   lp[2] = lradius
 * @return {Object}
 */
SensorPath.prototype.getLinearPoint = function(p, lp) {
    var s1 = vectorPos( p  );
    var s2 = vectorPos( lp );
    var s  = [ s1[0]-s2[0], s1[1]-s2[1], s1[2]-s2[2] ];
//    console.log("s1: "+ s1 + "  s2: "+s2 + "  s: " + s +"\n");
    var n0  = calcVertex( (p[0]+lp[0])*0.5, (p[1]+lp[1])*0.5, p[2] );
    var l = vec3.create();
    vec3.cross(l, s, n0);
    vec3.normalize(l, l);
    vec3.scale(l, l, this.path_width * 0.002);
//    console.log("vec l: " + vec3.str(l));

    var linearPoint = [];
    var color = [];
    var vertex;
    var that = this;

    var pushVertex = function() {
        color = color.concat(that.color);
        linearPoint.push.apply(linearPoint, vertex);
    }

    vertex = [s1[0]-l[0], s1[1]-l[1], s1[2]-l[2]];   // 0
    pushVertex();
    vertex = [s1[0]+l[0], s1[1]+l[1], s1[2]+l[2]];   // 1
    pushVertex();
    vertex = [s2[0]-l[0], s2[1]-l[1], s2[2]-l[2]];   // 2
    pushVertex();
    vertex = [s2[0]+l[0], s2[1]+l[1], s2[2]+l[2]];   // 3
    pushVertex();

    var index  = [];
    var n = this.cur_path_count / 3;  // it is better than index.length
    index.push(n + 0, n + 2, n + 3, n + 0, n + 3, n + 1);
    index.push(n + 0, n + 3, n + 2, n + 0, n + 1, n + 3);

    return {
        "point" : linearPoint,
        "color" : color,
        "index" : index,
    }
}

/**
 * 重置路径变量
 */
SensorPath.prototype.resetCurrentPath = function(vec) {
    this.cur_path_count  = 0;
    this.cur_index_count = 0;
    this.pg              = 0;
}

SensorPath.prototype.resetAllPath = function() {
    this.cur_pi = 0;
    // 删掉无用的buffer，节省内存
    for (var i = 0; i <= this.cur_pi; i++) {
        gl.deleteBuffer(this.buffers.path[i] );
        gl.deleteBuffer(this.buffers.index[i]);
        gl.deleteBuffer(this.buffers.color[i]);
    }
    this.all_path_count  = 0;
    this.all_index_count = 0;
    this.createBuffer();
    this.last_point = calcSensorNormal();
    this.resetCurrentPath();
}

SensorPath.prototype.createBuffer = function() {
    this.buffers.color[this.cur_pi]   = createArrayBuffer(gl.ARRAY_BUFFER,         this.buffer_path_bytes,  gl.DYNAMIC_DRAW);
    this.buffers.path[this.cur_pi]    = createArrayBuffer(gl.ARRAY_BUFFER,         this.buffer_path_bytes,  gl.DYNAMIC_DRAW);
    this.buffers.index[this.cur_pi]   = createArrayBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffer_index_bytes, gl.DYNAMIC_DRAW);
}

// ================= SensorPath Object ======================= //

// **************** Ball Object **************** //
/**
 * @param {Number} dradius  the default radius to set
 */
function Ball(dradius) {
    // 绘制球面时的精度, 至少为 4 的倍数
    this.n          = 48;
    this.ratio      = 0.25;  // default radius
    this.radius     = 4;
    this.mMatrix    = mat4.create();
    this.vscale     = vec3.create();
    this.line_alpha = 0.55;
    this.buffers  = {};
    this.d_color  = [0.3, 0.3, 0.3];
}

Ball.prototype.init = function(gl) {
    var res = this.getVertex();
    this.getIndex();

    // vertex info，static_draw is enough for both vertex and index now
    this.buffers.vertex          = createArrayBuffer(gl.ARRAY_BUFFER,         new Float32Array(res.vertex),          gl.STATIC_DRAW);
    this.buffers.color           = createArrayBuffer(gl.ARRAY_BUFFER,         new Float32Array(res.color),           gl.STATIC_DRAW);        // color info for each vertex
    this.buffers.vertex_index    = createArrayBuffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.vertex_index),    gl.STATIC_DRAW);
    this.buffers.line_index      = createArrayBuffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.line_index),      gl.STATIC_DRAW);
    this.buffers.less_line_index = createArrayBuffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.less_line_index), gl.STATIC_DRAW);
    this.buffers.less_ls_index   = createArrayBuffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.less_ls_index),   gl.STATIC_DRAW);
    // no need for normal vertex buffer anymore
    // this.vertex_normal_buffer   = createArrayBuffer(gl.ARRAY_BUFFER,         new Float32Array(this.vertex),    gl.STATIC_DRAW);
}

Ball.prototype.paint = function(gl, addon) {
    if( this.radius !== addon.ball_radius ) {
        this.radius   = addon.ball_radius * this.ratio || 1;
        this.vscale   = vec3.fromValues(this.radius, this.radius, this.radius);
        mat4.fromScaling(this.mMatrix, this.vscale);
//        mat4.identity(this.mMatrix);
//        mat4.scale(this.mMatrix, this.mMatrix, this.vscale);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.color);     // color buffer
    gl.vertexAttribPointer(attributes.color,           3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.vertex);    // normal info
    gl.vertexAttribPointer(attributes.vertex_normal,   3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.vertex);    // vertex info
    gl.vertexAttribPointer(attributes.vertex_position, 3, gl.FLOAT, false, 0, 0);

    mat4.multiply(mvpMatrix, pvMatrix, this.mMatrix);
    gl.uniformMatrix4fv(uniforms.pmv_matrix, false, mvpMatrix);
    switch (addon.draw_mode) {
        case "line":
            gl.uniform1f(uniforms.alpha, this.line_alpha);          //  set alpha value
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.line_index);
            gl.drawElements(gl.LINES, this.line_index.length, gl.UNSIGNED_SHORT, 0);
            break;
        case "lessLine":
            gl.uniform1f(uniforms.alpha, this.line_alpha);          //  set alpha value
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.less_line_index);
            gl.drawElements(gl.LINES, this.less_line_index.length, gl.UNSIGNED_SHORT, 0);
            // the surface on which equator lies
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.less_ls_index);
            gl.drawElements(gl.TRIANGLE_FAN, this.less_ls_index.length, gl.UNSIGNED_SHORT,  0);  // multiply 2 times means that UNSIGNED_SHORT occupies 2 bytes
            break;
        case "surface":
        default:
            gl.uniform1f(uniforms.alpha, addon.ball_alpha);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.vertex_index);
            gl.drawElements(gl.TRIANGLES, this.vertex_index.length, gl.UNSIGNED_SHORT, 0);
            break;
    }
}

/**
 * 计算得到球面的所有顶点的位置
 * 先绘制经线，后绘制纬线
 * @returns 返回所有类型的顶点个数
 */
Ball.prototype.getVertex = function() {
    var n = this.n;
    var vertex = [];
    var color  = [];
    //    var vn = [];        // 顶点法向量数组，当球心在原点时，与顶点坐标相同
    var i, j, k;

    var that = this;
    var pushData = function(p) {
        vertex.push.apply(vertex, p);
        color.push.apply(color, that.d_color);
    }

    // i indicates vertical line while j indicates horizontal line,
    // vertical line is half a circle, so the number should be 1 more
    for (j = 0; j <= n; j++) {
        for (i = 0; i <= n; i++) {
            // (n+1)*n points are needed
            k = calcVertex(degToRad(i*180/n), degToRad(j*360/n), this.radius);
            pushData(k);
        }
    }
    // add origin point into array
    pushData([0, 0, 0]);
//    this.vertex = vertex;
//    this.color  = color;
    return {
        "vertex": vertex,
        "color" : color
    }
}

/**
 * 获取绘制球面时需要的顶点索引
 */
Ball.prototype.getIndex = function() {
    var n       = this.n;
    var vertexIndex   = []; // surfaceDrawMode  绘制时所用的索引
    var lineIndex     = []; // lineDrawMode     绘制时所用的索引
    var lessLineIndex = []; // lessLineDrawMode 绘制时所用的索引
    var lessLSIndex   = [];
    var i = 0, j = 0;

    for (j = 0; j < n; j++) {  // the last half circle (j = 0) overlaps the first one (j = 0)
        for (i = 0; i < n+1; i++) {
            // for line mode index
            lineIndex.push(
                this.calcIndex(i, j),
                this.calcIndex(i+1, j),
                this.calcIndex(i, j),
                this.calcIndex(i, j+1)
            );

            // for surface mode index
            vertexIndex.push(
                this.calcIndex(i, j),       // 0
                this.calcIndex(i+1, j),     // 1
                this.calcIndex(i+1, j+1)    // n+1
            );
            vertexIndex.push(
                this.calcIndex(i, j),       // 0
                this.calcIndex(i+1, j+1),   // n+1
                this.calcIndex(i, j+1)      // n
            );
        }
    }
    for (i = 0; i < n+1; i++) {
        // 绘出 4 条经线
        lessLineIndex.push( this.calcIndex(i, 0),      this.calcIndex(i+1, 0)      );
        lessLineIndex.push( this.calcIndex(i, 0.25*n), this.calcIndex(i+1, 0.25*n) );
        lessLineIndex.push( this.calcIndex(i, 0.5 *n), this.calcIndex(i+1, 0.5 *n) );
        lessLineIndex.push( this.calcIndex(i, 0.75*n), this.calcIndex(i+1, 0.75*n) );
    }
    for (j = 0; j < n; j++) {
        i = n / 2 ;
        lessLineIndex.push(this.calcIndex(i, j), this.calcIndex(i, j+1)); // equator line
    }
    // 赤道所在平面
    for (j = n*0.5; j < n*0.75+1; j++) {
        // 原点 -- 赤道上的点 -- 赤道上的点
        lessLSIndex.push(this.calcIndex(n*0.5, j));
    }
    lessLSIndex.push((n+1)*(n+1));   // origin point

    this.vertex_index = vertexIndex;
    this.line_index   = lineIndex;
    this.less_line_index = lessLineIndex;
    this.less_ls_index   = lessLSIndex;
}

/**
 * 方便计算球体索引 index 的值
 * @param  i       半圆中第 i 部分
 * @param  j       第 j 个半圆
 */
Ball.prototype.calcIndex = function(i, j) {
    return i + j * (this.n+1);
}
// ===================== Ball Object ================ //


// ****************  Coord Object **************** //
function Coord() {
    this.type         = "Coord";
    this.coord_length = 10.0;
    this.mMatrix = mat4.create();
    this.buffers = {};
}

Coord.prototype = {
    constructor: Coord,

    init : function(gl) {
        var coordVertex = [ // x coord
            0.0, 0.0, 0.0,
            this.coord_length, 0.0, 0.0,
            // y coord
            0.0, 0.0, 0.0,
            0.0, this.coord_length, 0.0,
            // z coord
            0.0, 0.0, 0.0,
            0.0, 0.0, this.coord_length
        ];
        var coordIndex = [0, 1, 2, 3, 4, 5];
        // 坐标轴的颜色
        var lineColorData = [
            // x
            0.9, 0.1, 0,
            0.9, 0.1, 0,
            // y
            0, 0.9, 0,
            0, 0.9, 0,
            // z blue
            0, 0, 0.9,
            0, 0, 0.9,
        ];

        // 顶点信息，索引只需要用static draw
        this.buffers.coord  = createArrayBuffer(gl.ARRAY_BUFFER,         new Float32Array(coordVertex),   gl.STATIC_DRAW);
        this.buffers.index  = createArrayBuffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(coordIndex),     gl.STATIC_DRAW);
        this.buffers.color  = createArrayBuffer(gl.ARRAY_BUFFER,         new Float32Array(lineColorData), gl.STATIC_DRAW);
    },

    paint : function(gl) {
        mat4.multiply(mvpMatrix, pvMatrix, this.mMatrix);
        gl.uniformMatrix4fv(uniforms.pmv_matrix, false, mvpMatrix);

        gl.uniform1f(uniforms.alpha, 1.0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.color);
        gl.vertexAttribPointer(attributes.color,           3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.coord);      // normal
        gl.vertexAttribPointer(attributes.vertex_normal,   3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.coord);      // vertex
        gl.vertexAttribPointer(attributes.vertex_position, 3, gl.FLOAT, false, 0, 0);
        // 绘制坐标轴
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.index);
        gl.drawElements(gl.LINES, 6, gl.UNSIGNED_SHORT, 0);
    }
}

// ================  Coord Object ================ //

// **************** ReferenceCircle Object (球面上的参考圆圈) **************** //
function RefCircle() {
    this.type       = "RefCircle";
    this.sides      = 24;
    this.dis        = 2;
    this.circle_size= 1.0;
    this.circle_num = 26;
    this.circles    = [];
    this.translation= [];

    this.buffers     = {};
    this.mMatrix     = mat4.create();
    this.vscale      = vec3.create();
    this.blue_color  = [0.0, 0.0, 1.0];
    this.green_color = [0.0, 1.0, 0.0];
}

RefCircle.prototype = {
    constructor: RefCircle,

    init : function(gl) {
        // generate circles angle
        var i, j;
        this.circles.push([degToRad(0*45), degToRad(0*45), this.green_color]);
        for(i = 1; i <= 3; i ++ ) {
            for(j = 0; j < 8; j++) {
                if( i === 2 && j%2 === 0 ) {
                    this.circles.push([degToRad(i*45), degToRad(j*45), this.green_color]);
                } else {
                    this.circles.push([degToRad(i*45), degToRad(j*45), this.blue_color]);
                }
            }
        }
        this.circles.push([degToRad(4*45), degToRad(0*45), this.green_color]);

        for(i = 0; i < this.circle_num; i++) {
            this.translation[i] = calcVertex(this.circles[i][0], this.circles[i][1], this.dis);
        }

        var p = this.getPoints();
        this.buffers.ref_circle       = createArrayBuffer(gl.ARRAY_BUFFER,         new Float32Array(p.vertex),    gl.STATIC_DRAW);
        this.buffers.ref_color        = createArrayBuffer(gl.ARRAY_BUFFER,         new Float32Array(p.color),     gl.STATIC_DRAW);
        this.buffers.normal           = createArrayBuffer(gl.ARRAY_BUFFER,         new Float32Array(p.normal),    gl.STATIC_DRAW);
        this.buffers.ref_circle_index = createArrayBuffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(p.index),      gl.STATIC_DRAW);
    },

    paint : function(gl, addon) {
        if( !addon.calibration ) {
            return;
        }

        gl.bindBuffer(gl.ARRAY_BUFFER,         this.buffers.ref_color);
        gl.vertexAttribPointer(attributes.color,           3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER,         this.buffers.normal);
        gl.vertexAttribPointer(attributes.vertex_normal,   3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER,         this.buffers.ref_circle);
        gl.vertexAttribPointer(attributes.vertex_position, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.ref_circle_index);
        gl.uniform1f(uniforms.alpha, 1.0);
        var i;

        if( this.dis !== addon.ball_radius ) {
            this.dis   = addon.ball_radius;
            for(i = 0; i < this.circle_num; i++) {
                this.translation[i] = calcVertex(this.circles[i][0], this.circles[i][1], this.dis);
            }
        }

        if( this.circle_size !== addon.circle_size) {
            this.circle_size = addon.circle_size;
            this.vscale  = vec3.fromValues(addon.circle_size, addon.circle_size, addon.circle_size);
        }

        for(i = 0; i < this.circle_num; i++) {
            mat4.fromTranslation(this.mMatrix, this.translation[i]);
            mat4.scale(this.mMatrix, this.mMatrix, this.vscale);            // scale by pointSize
            mat4.mul(mvpMatrix, pvMatrix, this.mMatrix);
            gl.uniformMatrix4fv(uniforms.pmv_matrix, false, mvpMatrix);
            gl.drawElements(gl.LINES, this.sides, gl.UNSIGNED_SHORT, i*this.sides*2);
        }

    },

    // 获取参考圆圈的顶点
    getPoints : function() {
        var vertex  = [];
        var normal  = [];
        var color   = [];
        var index   = [];
        var i = 0, j = 0, n = 0;

        var that = this;
        this.circles.forEach(function(e) {
            var tmpver  = [];
            var k;
            for (j = 0; j < that.sides; j++) {
                // generate vertices on plane XOY
                k = calcVertex(degToRad(90), degToRad(j*360/that.sides), that.circle_size);
                tmpver.push.apply(tmpver, k);
                color = color.concat(e[2]);
                normal= normal.concat([0.75, 0.75, 0.75]);  // make sure that all circles are visible bright
            }
            rotateVertex(tmpver, e[0], e[1]);
            vertex.push.apply(vertex, tmpver);
        });

        for(i = 0; i < this.circle_num * this.sides; i++) {
            index.push(i);
        }
        return {
            "vertex": vertex,
            "index":  index,
            "normal": normal,
            "color":  color
        };
    }
}


function RecordPoint() {
    this.type        = "RecordPoint";
    this.sides       = 24;
    this.buffers     = {};
    this.max_record_bytes       = this.sides * 4 * 100;
    this.max_record_index_bytes = this.sides * 2 * 100;
    this.record_point_count = 0;
    this.record_index_count = 0;
}

RecordPoint.prototype = {
    constructor: RecordPoint,

    init : function(gl) {
        this.buffers.record_point     = createArrayBuffer(gl.ARRAY_BUFFER,         this.max_record_bytes,         gl.DYNAMIC_DRAW);
        this.buffers.record_color     = createArrayBuffer(gl.ARRAY_BUFFER,         this.max_record_bytes,         gl.DYNAMIC_DRAW);
        this.buffers.record_index     = createArrayBuffer(gl.ELEMENT_ARRAY_BUFFER, this.max_record_index_bytes,   gl.DYNAMIC_DRAW);
    },

    paint : function(gl, addon) {
        // 进行采点操作
        if(this.record_point_count > 0) {
            gl.bindBuffer(gl.ARRAY_BUFFER,         this.buffers.record_color);
            gl.vertexAttribPointer(attributes.color,           3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER,         this.buffers.record_point);
            gl.vertexAttribPointer(attributes.vertex_normal,   3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER,         this.buffers.record_point);
            gl.vertexAttribPointer(attributes.vertex_position, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.record_index);
    //        gl.uniform4fv(uniforms.color_unit, [0.1, 0.1, 0.95, 1.1]); // 传入颜色 uniform，就不再需要颜色顶点数据
            gl.uniform1f(uniforms.alpha, 1.0);
            gl.uniformMatrix4fv(uniforms.pmv_matrix, false, pvMatrix);
            gl.drawElements(gl.TRIANGLES, this.record_index_count, gl.UNSIGNED_SHORT, 0);
        }
    },

    record : function(addon) {
        if( !addon.calibration) {
            return;
        }
        console.log("[Info]: record a point.");

        var i = 0, j =0;
        var point = [];
        var index = [];
        var color = [];

        for(i = 0; i <= this.sides; i++) {
            color = color.concat([0, 0.5, 0.5]);
        }
        point = calcCircle(this.sides, addon.point_size + 0.03 , addon.ball_radius + 0.01, true);
        rotateVertex(point, degToRad(90-addon.pitch), degToRad(addon.heading));

        var n = this.record_point_count / 3;
        for(i = 1; i < this.sides; i++) {
            index.push(
                        n, n+i,   n+i+1,
                        n, n+i+1, n+i
                       );
        }
        index.push(
                    n, n+this.sides, n+1,
                    n, n+1,          n+this.sides
                   );
        updateSubBuffer(gl.ARRAY_BUFFER,         this.buffers.record_point, this.record_point_count * 4, new Float32Array(point));
        updateSubBuffer(gl.ARRAY_BUFFER,         this.buffers.record_color, this.record_point_count * 4, new Float32Array(color));
        updateSubBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.record_index, this.record_index_count * 2, new Uint16Array(index));

        this.record_point_count += point.length;
        this.record_index_count += index.length;
    },

    // 重置已经打的点
    reset : function() {
        this.record_point_count = 0;
        this.record_index_count = 0;
    }

}


// ================= ReferenceCircle Object =======================//

function Craft(props) {
    this.type    = "Craft";
    this.url     = "qrc:/obj/craft.obj";
    this.mMatrix = mat4.create();
    this.vscale  = vec3.create();
}

Craft.prototype = {
    constructor: Craft,

    init: function(gl) {
        var objStr =
//        var mesh = new OBJ.Mesh()
    },

    paint: function(gl, addon) {

    }
}

