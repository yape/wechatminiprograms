// 云函数入口文件
const cloud = require('wx-server-sdk')

const https = require('https')

const querystring = require('querystring')

cloud.init()

function requestAMap(params) {

  const qs = querystring.stringify(params)

  const url = `https://restapi.amap.com/v3/place/around?${qs}`

  return new Promise((resolve, reject) => {

    https

      .get(url, (res) => {

        let data = ''

        res.on('data', (chunk) => (data += chunk))

        res.on('end', () => {

          try {

            const json = JSON.parse(data)

            resolve(json)

          } catch (e) {

            reject(new Error('AMap 响应解析失败'))

          }

        })
      })
      .on('error', (err) => reject(err))
  })
}

exports.main = async (event) => {

  const { latitude, longitude, radius = 1500, types = '050000' } = event || {}

  if (!latitude || !longitude) {

    return { code: 400, message: '缺少定位信息' }

  }

  const key = process.env.GAODE_KEY

  const params = {

    key,

    location: `${longitude},${latitude}`,

    radius: String(radius),

    types,

    offset: '25',

    page: '1',

    extensions: 'all',

    sortrule: 'distance'

  }



  try {

    const json = await requestAMap(params)

    if (json.status !== '1') {

      return { code: 502, message: json.info || '高德接口调用失败', raw: json }

    }

    const pois = Array.isArray(json.pois) ? json.pois : []

    const mapped = pois.map((p) => ({

      id: p.id,

      name: p.name,

      location: p.location, // lng,lat

      distance: Number(p.distance || 0),

      address: p.address,

      adname: p.adname,

      business: p.type,

      rating: p.biz_ext ? p.biz_ext.rating : null,

      cost: p.biz_ext ? p.biz_ext.cost : null,

      tag: p.tag,

      typeName: p.typecode ? p.type : ''

    }))

    return { code: 0, pois: mapped }

  } catch (e) {

    return { code: 500, message: e.message || '请求异常' }

  }

}



