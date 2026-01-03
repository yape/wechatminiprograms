// 云函数入口文件
const cloud = require('wx-server-sdk')

const https = require('https')

const querystring = require('querystring')

cloud.init()

// 模拟大众点评优惠券数据（后续替换为真实API）
// 实际对接时，需要通过店铺名称+地址匹配大众点评店铺ID，再获取优惠券
function mockDianpingCoupons(poiName, poiAddress) {
  // 模拟30%的店铺有优惠券
  const hasCoupon = Math.random() < 0.3;
  if (!hasCoupon) return null;

  // 模拟不同类型的优惠券
  const couponTypes = [
    { type: 'discount', title: '满100减20', originalPrice: 100, discountPrice: 80, discountAmount: 20, discountPercent: 20 },
    { type: 'discount', title: '满200减50', originalPrice: 200, discountPrice: 150, discountAmount: 50, discountPercent: 25 },
    { type: 'discount', title: '满50减10', originalPrice: 50, discountPrice: 40, discountAmount: 10, discountPercent: 20 },
    { type: 'groupon', title: '双人套餐', originalPrice: 168, discountPrice: 99, discountAmount: 69, discountPercent: 41 },
    { type: 'groupon', title: '四人聚餐套餐', originalPrice: 358, discountPrice: 199, discountAmount: 159, discountPercent: 44 },
    { type: 'groupon', title: '单人工作餐', originalPrice: 38, discountPrice: 19.9, discountAmount: 18.1, discountPercent: 48 },
    { type: 'voucher', title: '代金券', originalPrice: 100, discountPrice: 80, discountAmount: 20, discountPercent: 20 },
  ];

  const coupon = couponTypes[Math.floor(Math.random() * couponTypes.length)];
  
  return {
    ...coupon,
    // 模拟CPS链接（实际对接时替换为真实推广链接）
    cpsLink: `https://m.dianping.com/shop/mock?name=${encodeURIComponent(poiName)}&source=miniapp`,
    // 模拟点评店铺ID
    dpShopId: 'mock_' + Math.random().toString(36).substr(2, 9),
    // 券的有效期
    expireDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  };
}

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

    const mapped = pois.map((p) => {
      // 获取优惠券信息
      const coupon = mockDianpingCoupons(p.name, p.address);
      
      return {
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
        typeName: p.typecode ? p.type : '',
        // CPS优惠券信息
        coupon: coupon,
        // 优惠力度分数（用于推荐权重计算）
        discountScore: coupon ? coupon.discountPercent : 0
      };
    })

    return { code: 0, pois: mapped }

  } catch (e) {

    return { code: 500, message: e.message || '请求异常' }

  }

}



